import { SignInButton } from "@clerk/clerk-react";
import { convexQuery } from "@convex-dev/react-query";
import { useMutation } from "convex/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { Calendar, Plus, Clock, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";

type ViewType = "weekly" | "daily" | "monthly";

const currentUserQuery = convexQuery(api.users.getCurrentUser, {});

export const Route = createFileRoute("/")({
  loader: async ({ context: { queryClient } }) => {
    await queryClient.ensureQueryData(currentUserQuery);
  },
  component: HomePage,
});

function HomePage() {
  return (
    <div>
      <Unauthenticated>
        <div className="text-center">
          <div className="not-prose flex justify-center mb-4">
            <Calendar className="w-16 h-16 text-primary" />
          </div>
          <h1>Workplace Scheduler</h1>
          <p>Sign in to manage your workplace schedule.</p>
          <div className="not-prose mt-4">
            <SignInButton mode="modal">
              <button className="btn btn-primary btn-lg">Sign In</button>
            </SignInButton>
          </div>
        </div>
      </Unauthenticated>

      <Authenticated>
        <ScheduleApp />
      </Authenticated>
    </div>
  );
}

function ScheduleApp() {
  const { data: currentUser } = useSuspenseQuery(currentUserQuery);
  const [viewType, setViewType] = useState<ViewType>("weekly");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const ensureUser = useMutation(api.users.ensureUser);

  useEffect(() => {
    void ensureUser();
  }, [ensureUser]);

  if (!currentUser) {
    return <div>Loading...</div>;
  }

  const getDateRange = () => {
    const date = new Date(currentDate);
    
    switch (viewType) {
      case "daily": {
        const dayStart = new Date(date);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        return { start: dayStart.getTime(), end: dayEnd.getTime() };
      }
        
      case "monthly": {
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 1);
        return { start: monthStart.getTime(), end: monthEnd.getTime() };
      }
        
      default: { // weekly
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        return { start: weekStart.getTime(), end: weekEnd.getTime() };
      }
    }
  };

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    
    switch (viewType) {
      case "daily":
        newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
        break;
      case "monthly":
        newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
        break;
      default: // weekly
        newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
        break;
    }
    
    setCurrentDate(newDate);
  };

  const formatDateDisplay = () => {
    switch (viewType) {
      case "daily":
        return currentDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      case "monthly":
        return currentDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long' 
        });
      default: { // weekly
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
    }
  };

  return (
    <div className="min-h-screen bg-base-100">
      <div className="navbar bg-primary text-primary-content">
        <div className="navbar-start">
          <Calendar className="w-8 h-8 mr-2" />
          <span className="text-xl font-bold">Workplace Scheduler</span>
        </div>
        <div className="navbar-end">
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost">
              <Users className="w-5 h-5 mr-2" />
              {currentUser.name}
              {currentUser.role === "manager" && <div className="badge badge-secondary ml-2">Manager</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4">
        <div className="flex flex-col lg:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-2">
            <button 
              className="btn btn-sm btn-circle"
              onClick={() => navigateDate("prev")}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <h2 className="text-2xl font-bold min-w-[300px] text-center">
              {formatDateDisplay()}
            </h2>
            
            <button 
              className="btn btn-sm btn-circle"
              onClick={() => navigateDate("next")}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <div className="join">
              <button 
                className={`btn join-item ${viewType === "daily" ? "btn-active" : ""}`}
                onClick={() => setViewType("daily")}
              >
                Day
              </button>
              <button 
                className={`btn join-item ${viewType === "weekly" ? "btn-active" : ""}`}
                onClick={() => setViewType("weekly")}
              >
                Week
              </button>
              <button 
                className={`btn join-item ${viewType === "monthly" ? "btn-active" : ""}`}
                onClick={() => setViewType("monthly")}
              >
                Month
              </button>
            </div>
            
            <button 
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Event
            </button>
          </div>
        </div>

        <ScheduleView 
          dateRange={getDateRange()}
          currentUser={currentUser}
        />
        
        {currentUser.role === "manager" && <PendingApprovals />}
      </div>

      {showCreateModal && (
        <CreateEventModal 
          currentUser={currentUser}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

function ScheduleView({ dateRange, currentUser }: {
  dateRange: { start: number; end: number };
  currentUser: any;
}) {
  const eventsQuery = convexQuery(api.events.getVisibleEvents, {
    startDate: dateRange.start,
    endDate: dateRange.end,
  });
  const { data: events } = useSuspenseQuery(eventsQuery);

  const approveEvent = useMutation(api.events.approveEvent);

  const handleApprove = async (eventId: string) => {
    try {
      await approveEvent({ eventId: eventId as any });
    } catch (error) {
      console.error("Failed to approve event:", error);
    }
  };

  if (events.length === 0) {
    return (
      <div className="text-center p-8 bg-base-200 rounded-lg">
        <Clock className="w-16 h-16 mx-auto mb-4 text-base-content opacity-50" />
        <p className="text-lg opacity-70">No events scheduled for this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <div key={event._id} className="card bg-base-200">
          <div className="card-body">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="card-title">
                  {event.title}
                  {event.status === "pending" && (
                    <div className="badge badge-warning">Pending</div>
                  )}
                </h3>
                <p className="text-sm opacity-70 mb-2">{event.description}</p>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span>
                    <strong>Time:</strong> {new Date(event.startTime).toLocaleString()} - {new Date(event.endTime).toLocaleString()}
                  </span>
                  <span>
                    <strong>Assigned to:</strong> {event.assignedUser?.name}
                  </span>
                  <span>
                    <strong>Created by:</strong> {event.creator?.name}
                  </span>
                </div>
              </div>
              
              {event.status === "pending" && currentUser.role === "manager" && (
                <div className="card-actions">
                  <button 
                    className="btn btn-sm btn-success"
                    onClick={() => void handleApprove(event._id)}
                  >
                    Approve
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PendingApprovals() {
  const pendingEventsQuery = convexQuery(api.events.getPendingEvents, {});
  const { data: pendingEvents } = useSuspenseQuery(pendingEventsQuery);

  if (pendingEvents.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <h3 className="text-xl font-bold mb-4">Pending Approvals ({pendingEvents.length})</h3>
      <div className="space-y-2">
        {pendingEvents.map((event) => (
          <div key={event._id} className="alert">
            <div>
              <h4 className="font-bold">{event.title}</h4>
              <p className="text-sm">
                Created by {event.creator?.name} for {event.assignedUser?.name}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateEventModal({ currentUser, onClose }: { currentUser: any; onClose: () => void }) {
  const usersQuery = convexQuery(api.users.listUsers, {});
  const { data: users } = useSuspenseQuery(usersQuery);
  const createEvent = useMutation(api.events.createEvent);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    assignedUserId: currentUser._id,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await createEvent({
        title: formData.title,
        description: formData.description,
        startTime: new Date(formData.startTime).getTime(),
        endTime: new Date(formData.endTime).getTime(),
        assignedUserId: formData.assignedUserId,
      });
      onClose();
    } catch (error) {
      console.error("Failed to create event:", error);
    }
  };

  return (
    <dialog open className="modal">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">Create New Event</h3>
        
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="label">
              <span className="label-text">Title</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>
          
          <div>
            <label className="label">
              <span className="label-text">Description</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">
                <span className="label-text">Start Time</span>
              </label>
              <input
                type="datetime-local"
                className="input input-bordered w-full"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                required
              />
            </div>
            
            <div>
              <label className="label">
                <span className="label-text">End Time</span>
              </label>
              <input
                type="datetime-local"
                className="input input-bordered w-full"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                required
              />
            </div>
          </div>
          
          <div>
            <label className="label">
              <span className="label-text">Assign to</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.assignedUserId}
              onChange={(e) => setFormData({ ...formData, assignedUserId: e.target.value })}
            >
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          </div>
          
          <div className="modal-action">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Event
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
