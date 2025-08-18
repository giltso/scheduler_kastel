import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";

export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (existingUser) {
      // Update name/email if they have changed in Clerk
      const clerkName = identity.name ?? "Anonymous";
      const clerkEmail = identity.email ?? "";
      
      if (existingUser.name !== clerkName || existingUser.email !== clerkEmail) {
        await ctx.db.patch(existingUser._id, { 
          name: clerkName,
          email: clerkEmail 
        });
        return await ctx.db.get(existingUser._id);
      }
      return existingUser;
    }

    // Create new user with default role
    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: identity.name ?? "Anonymous",
      email: identity.email ?? "",
      role: "default",
    });

    return await ctx.db.get(userId);
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
  },
});

export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("default"), v.literal("manager")),
  },
  handler: async (ctx, { userId, role }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!currentUser || currentUser.role !== "manager") {
      throw new ConvexError("Only managers can update user roles");
    }

    await ctx.db.patch(userId, { role });
    return await ctx.db.get(userId);
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Not authenticated");
    }

    const users = await ctx.db.query("users").collect();
    return users;
  },
});
