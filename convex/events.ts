import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

export const createEvent = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    assignedUserId: v.id("users"),
    isRepeating: v.optional(v.boolean()),
    repeatDays: v.optional(v.array(v.number())),
  },
  handler: async (ctx, { title, description, startTime, endTime, assignedUserId, isRepeating, repeatDays }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      throw new ConvexError("User not found");
    }

    if (startTime >= endTime) {
      throw new ConvexError("Start time must be before end time");
    }

    // Validate repeating event data
    if (isRepeating && (!repeatDays || repeatDays.length === 0)) {
      throw new ConvexError("Repeating events must have at least one repeat day selected");
    }

    // Managers create approved events, default users create pending events
    const status = currentUser.role === "manager" ? "approved" : "pending";

    if (!isRepeating) {
      // Create a single non-repeating event
      const eventId = await ctx.db.insert("events", {
        title,
        description,
        startTime,
        endTime,
        creatorId: currentUser._id,
        assignedUserId,
        status,
        isRepeating: false,
      });

      return await ctx.db.get(eventId);
    } else {
      // Create only the parent repeating event - instances will be generated for display
      const parentEventId = await ctx.db.insert("events", {
        title,
        description,
        startTime,
        endTime,
        creatorId: currentUser._id,
        assignedUserId,
        status,
        isRepeating: true,
        repeatDays,
      });

      return await ctx.db.get(parentEventId);
    }
  },
});

export const approveEvent = mutation({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, { eventId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser || currentUser.role !== "manager") {
      throw new ConvexError("Only managers can approve events");
    }

    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new ConvexError("Event not found");
    }

    if (event.status === "approved") {
      throw new ConvexError("Event is already approved");
    }

    await ctx.db.patch(eventId, { status: "approved" });
    return await ctx.db.get(eventId);
  },
});

export const getVisibleEvents = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, { startDate, endDate }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      throw new ConvexError("User not found");
    }

    // Get all events (both regular and repeating parent events)
    const allEvents = await ctx.db.query("events").collect();

    // Filter based on user role and visibility rules
    const visibleEvents = allEvents.filter((event) => {
      // Skip events that have a parentEventId (these were old instances)
      if (event.parentEventId) {
        return false;
      }

      // Approved events are visible to everyone
      if (event.status === "approved") {
        return true;
      }
      
      // Pending events are visible to:
      // 1. The creator
      // 2. Managers
      if (event.status === "pending") {
        return event.creatorId === currentUser._id || currentUser.role === "manager";
      }
      
      return false;
    });

    // Generate display events (expand repeating events into instances)
    const displayEvents = [];
    
    for (const event of visibleEvents) {
      if (!event.isRepeating) {
        // Regular event - only show if it's in the date range
        if (event.startTime >= startDate && event.startTime < endDate) {
          displayEvents.push(event);
        }
      } else {
        // Repeating event - generate instances within the date range
        const eventStartDate = new Date(event.startTime);
        const eventEndDate = new Date(event.endTime);
        
        // Calculate the duration of the original event (time between start and end on the same day)
        const sameDay = new Date(event.startTime);
        sameDay.setHours(eventEndDate.getHours(), eventEndDate.getMinutes(), eventEndDate.getSeconds(), eventEndDate.getMilliseconds());
        const eventDuration = sameDay.getTime() - event.startTime;
        
        // Find the overlap between the repeat period and the requested date range
        const periodStart = Math.max(event.startTime, startDate);
        const periodEnd = Math.min(event.endTime, endDate);
        
        if (periodStart < periodEnd) {
          let currentDate = new Date(periodStart);
          
          // Iterate through each day in the overlap period
          while (currentDate.getTime() < periodEnd) {
            const dayOfWeek = currentDate.getDay();
            
            // Check if this day is in the repeat days
            if (event.repeatDays && event.repeatDays.includes(dayOfWeek)) {
              // Create an instance for this day with the same time as the original
              const instanceDate = new Date(currentDate);
              instanceDate.setHours(eventStartDate.getHours(), eventStartDate.getMinutes(), eventStartDate.getSeconds(), eventStartDate.getMilliseconds());
              
              const instanceStartTime = instanceDate.getTime();
              const instanceEndTime = instanceStartTime + eventDuration;
              
              // Only include if the instance is within the requested range
              if (instanceStartTime >= startDate && instanceStartTime < endDate) {
                displayEvents.push({
                  ...event,
                  _id: `${event._id}_${instanceStartTime}`, // Unique ID for each instance
                  startTime: instanceStartTime,
                  endTime: instanceEndTime,
                  isRepeating: false, // Display instances as non-repeating
                  parentEventId: event._id,
                });
              }
            }
            
            // Move to the next day
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }
      }
    }

    // Get user details for each event
    const eventsWithUsers = await Promise.all(
      displayEvents.map(async (event) => {
        const [creator, assignedUser] = await Promise.all([
          ctx.db.get(event.creatorId),
          ctx.db.get(event.assignedUserId),
        ]);
        
        return {
          ...event,
          creator: creator ? { name: creator.name, role: creator.role } : null,
          assignedUser: assignedUser ? { name: assignedUser.name, role: assignedUser.role } : null,
        };
      })
    );

    return eventsWithUsers;
  },
});

export const getPendingEvents = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser || currentUser.role !== "manager") {
      throw new ConvexError("Only managers can view pending events");
    }

    const pendingEvents = await ctx.db
      .query("events")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    // Get user details for each event
    const eventsWithUsers = await Promise.all(
      pendingEvents.map(async (event) => {
        const [creator, assignedUser] = await Promise.all([
          ctx.db.get(event.creatorId),
          ctx.db.get(event.assignedUserId),
        ]);
        
        return {
          ...event,
          creator: creator ? { name: creator.name, role: creator.role } : null,
          assignedUser: assignedUser ? { name: assignedUser.name, role: assignedUser.role } : null,
        };
      })
    );

    return eventsWithUsers;
  },
});

export const getUserPendingEvents = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      throw new ConvexError("User not found");
    }

    const userPendingEvents = await ctx.db
      .query("events")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .filter((q) => q.eq(q.field("creatorId"), currentUser._id))
      .collect();

    // Get user details for each event
    const eventsWithUsers = await Promise.all(
      userPendingEvents.map(async (event) => {
        const [creator, assignedUser] = await Promise.all([
          ctx.db.get(event.creatorId),
          ctx.db.get(event.assignedUserId),
        ]);
        
        return {
          ...event,
          creator: creator ? { name: creator.name, role: creator.role } : null,
          assignedUser: assignedUser ? { name: assignedUser.name, role: assignedUser.role } : null,
        };
      })
    );

    return eventsWithUsers;
  },
});

export const rejectEvent = mutation({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, { eventId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser || currentUser.role !== "manager") {
      throw new ConvexError("Only managers can reject events");
    }

    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new ConvexError("Event not found");
    }

    if (event.status !== "pending") {
      throw new ConvexError("Only pending events can be rejected");
    }

    await ctx.db.patch(eventId, { status: "rejected" });
    return await ctx.db.get(eventId);
  },
});

export const updateEvent = mutation({
  args: {
    eventId: v.id("events"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    assignedUserId: v.optional(v.id("users")),
    isRepeating: v.optional(v.boolean()),
    repeatDays: v.optional(v.array(v.number())),
    status: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
  },
  handler: async (ctx, { eventId, ...updates }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      throw new ConvexError("User not found");
    }

    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new ConvexError("Event not found");
    }

    // Only creator or managers can update events
    if (event.creatorId !== currentUser._id && currentUser.role !== "manager") {
      throw new ConvexError("You can only update events you created");
    }

    if (updates.startTime !== undefined && updates.endTime !== undefined) {
      if (updates.startTime >= updates.endTime) {
        throw new ConvexError("Start time must be before end time");
      }
    }

    // If the user is not a manager and is editing their own event, set status to pending
    const finalUpdates: typeof updates & { status?: "pending" | "approved" | "rejected" } = { ...updates };
    if (currentUser.role !== "manager" && event.creatorId === currentUser._id) {
      finalUpdates.status = "pending";
    }

    await ctx.db.patch(eventId, finalUpdates);
    return await ctx.db.get(eventId);
  },
});

export const deleteEvent = mutation({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, { eventId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser) {
      throw new ConvexError("User not found");
    }

    const event = await ctx.db.get(eventId);
    if (!event) {
      throw new ConvexError("Event not found");
    }

    // Only creator or managers can delete events
    if (event.creatorId !== currentUser._id && currentUser.role !== "manager") {
      throw new ConvexError("You can only delete events you created");
    }

    await ctx.db.delete(eventId);
  },
});

