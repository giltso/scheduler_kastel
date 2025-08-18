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
  },
  handler: async (ctx, { title, description, startTime, endTime, assignedUserId }) => {
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

    // Managers create approved events, default users create pending events
    const status = currentUser.role === "manager" ? "approved" : "pending";

    const eventId = await ctx.db.insert("events", {
      title,
      description,
      startTime,
      endTime,
      creatorId: currentUser._id,
      assignedUserId,
      status,
    });

    return await ctx.db.get(eventId);
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

    // Get events in the date range
    const allEvents = await ctx.db
      .query("events")
      .withIndex("by_startTime", (q) => 
        q.gte("startTime", startDate).lt("startTime", endDate)
      )
      .collect();

    // Filter based on user role and visibility rules
    const visibleEvents = allEvents.filter((event) => {
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

    // Get user details for each event
    const eventsWithUsers = await Promise.all(
      visibleEvents.map(async (event) => {
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

export const updateEvent = mutation({
  args: {
    eventId: v.id("events"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    assignedUserId: v.optional(v.id("users")),
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

    await ctx.db.patch(eventId, updates);
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