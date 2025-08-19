import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema defines your data model for the database.
// For more information, see https://docs.convex.dev/database/schema
export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("default"), v.literal("manager")),
  }).index("by_clerkId", ["clerkId"]),
  
  events: defineTable({
    title: v.string(),
    description: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    creatorId: v.id("users"),
    assignedUserId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected")),
    // Repeating event fields
    isRepeating: v.optional(v.boolean()),
    repeatDays: v.optional(v.array(v.number())), // 0=Sunday, 1=Monday, etc.
    parentEventId: v.optional(v.id("events")), // For individual instances of repeating events
  })
    .index("by_creator", ["creatorId"])
    .index("by_assignedUser", ["assignedUserId"])
    .index("by_status", ["status"])
    .index("by_startTime", ["startTime"])
    .index("by_parentEvent", ["parentEventId"]),
});
