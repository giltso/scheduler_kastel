import { SignInButton } from "@clerk/clerk-react";
import { convexQuery } from "@convex-dev/react-query";
import { useMutation } from "convex/react";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { Calendar, Plus, Users, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useState, useEffect } from "react";
import { Calendar as BigCalendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";

type ViewType = "week" | "day" | "month";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: {},
});

const currentUserQuery = convexQuery(api.users.getCurrentUser, {});

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="not-prose">
      <Unauthenticated>
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Calendar className="w-16 h-16 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Workplace Scheduler</h1>
          <p className="text-lg mb-6">Sign in to manage your workplace schedule.</p>
          <div className="mt-4">
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
  const { data: currentUser, isLoading } = useQuery(currentUserQuery);
  const [viewType, setViewType] = useState<ViewType>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const ensureUser = useMutation(api.users.ensureUser);

  useEffect(() => {
    void ensureUser();
  }, [ensureUser]);

  if (isLoading || !currentUser) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="loading loading-spinner loading-lg"></div>
        <span className="ml-2">Loading workspace...</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold">Workplace Scheduler</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Users className="w-5 h-5" />
          <span>{currentUser.name}</span>
          {currentUser.role === "manager" && <div className="badge badge-secondary">Manager</div>}
        </div>
      </div>

      <div>
        <div className="flex flex-col lg:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex gap-2">
            <div className="join">
              <button 
                className={`btn join-item ${viewType === "day" ? "btn-active" : ""}`}
                onClick={() => setViewType("day")}
              >
                Day
              </button>
              <button 
                className={`btn join-item ${viewType === "week" ? "btn-active" : ""}`}
                onClick={() => setViewType("week")}
              >
                Week
              </button>
              <button 
                className={`btn join-item ${viewType === "month" ? "btn-active" : ""}`}
                onClick={() => setViewType("month")}
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

        <CalendarView 
          currentUser={currentUser}
          viewType={viewType}
          currentDate={currentDate}
          onNavigate={setCurrentDate}
          onSelectSlot={(_slotInfo) => setShowCreateModal(true)}
        />
        
        {currentUser.role === "manager" && <PendingApprovals />}

        {showCreateModal && (
          <CreateEventModal 
            currentUser={currentUser}
            onClose={() => setShowCreateModal(false)}
          />
        )}
      </div>
    </div>
  );
}

function CalendarView({ 
  currentUser, 
  viewType, 
  currentDate, 
  onNavigate,
  onSelectSlot 
}: {
  currentUser: any;
  viewType: ViewType;
  currentDate: Date;
  onNavigate: (date: Date) => void;
  onSelectSlot: (slotInfo: any) => void;
}) {
  // Get a wide date range to ensure we have all visible events for the calendar
  const startDate = new Date(currentDate);
  startDate.setMonth(startDate.getMonth() - 2);
  startDate.setDate(1);
  
  const endDate = new Date(currentDate);
  endDate.setMonth(endDate.getMonth() + 2);
  endDate.setDate(0);

  const eventsQuery = convexQuery(api.events.getVisibleEvents, {
    startDate: startDate.getTime(),
    endDate: endDate.getTime(),
  });
  const { data: events } = useSuspenseQuery(eventsQuery);


  // Convert events to react-big-calendar format
  const calendarEvents = events.map((event) => ({
    id: event._id,
    title: event.title,
    start: new Date(event.startTime),
    end: new Date(event.endTime),
    resource: {
      ...event,
      isPending: event.status === "pending",
      canApprove: event.status === "pending" && currentUser.role === "manager",
    },
  }));

  const EventComponent = ({ event }: { event: any }) => (
    <div className="flex items-center gap-1 text-xs">
      <span className={event.resource.isPending ? "opacity-70" : ""}>
        {event.title}
      </span>
      {event.resource.isPending && (
        <div className="badge badge-warning badge-xs">Pending</div>
      )}
    </div>
  );

  const handleNavigate = (action: 'prev' | 'next' | 'today') => {
    const newDate = new Date(currentDate);
    
    if (action === 'today') {
      onNavigate(new Date());
      return;
    }
    
    switch (viewType) {
      case 'day':
        newDate.setDate(newDate.getDate() + (action === 'next' ? 1 : -1));
        break;
      case 'month':
        newDate.setMonth(newDate.getMonth() + (action === 'next' ? 1 : -1));
        break;
      default: // week
        newDate.setDate(newDate.getDate() + (action === 'next' ? 7 : -7));
        break;
    }
    
    onNavigate(newDate);
  };

  const formatDateDisplay = () => {
    switch (viewType) {
      case 'day':
        return currentDate.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      case 'month':
        return currentDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long' 
        });
      default: { // week
        const weekStart = new Date(currentDate);
        weekStart.setDate(currentDate.getDate() - currentDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
    }
  };

  return (
    <div className="bg-base-100 rounded-lg p-4 min-h-[600px]">
      {/* Custom Navigation Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <button 
            className="btn btn-sm btn-circle"
            onClick={() => handleNavigate('prev')}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <button 
            className="btn btn-sm"
            onClick={() => handleNavigate('today')}
          >
            Return to Today
          </button>
          
          <button 
            className="btn btn-sm btn-circle"
            onClick={() => handleNavigate('next')}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        
        <h2 className="text-xl font-semibold">
          {formatDateDisplay()}
        </h2>
        
        <div></div> {/* Spacer for centering */}
      </div>
      
      <BigCalendar
        localizer={localizer}
        events={calendarEvents}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 600 }}
        view={viewType}
        onView={(_view: View) => {}} // Controlled by our view buttons
        date={currentDate}
        onNavigate={onNavigate}
        onSelectSlot={onSelectSlot}
        selectable
        popup
        toolbar={false} // Remove the built-in toolbar with duplicate buttons
        showMultiDayTimes={true} // Show times for multi-day events
        components={{
          event: EventComponent,
        }}
        eventPropGetter={(event: any) => ({
          className: event.resource.isPending ? "opacity-70" : "",
          style: {
            backgroundColor: event.resource.isPending ? "#fbbf24" : "#3b82f6",
            borderColor: event.resource.isPending ? "#f59e0b" : "#2563eb",
          },
        })}
      />
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
    isRepeating: false,
    repeatDays: [] as number[],
  });

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const toggleRepeatDay = (dayIndex: number) => {
    setFormData(prev => ({
      ...prev,
      repeatDays: prev.repeatDays.includes(dayIndex)
        ? prev.repeatDays.filter(d => d !== dayIndex)
        : [...prev.repeatDays, dayIndex].sort()
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await createEvent({
        title: formData.title,
        description: formData.description,
        startTime: new Date(formData.startTime).getTime(),
        endTime: new Date(formData.endTime).getTime(),
        assignedUserId: formData.assignedUserId,
        isRepeating: formData.isRepeating,
        repeatDays: formData.isRepeating ? formData.repeatDays : undefined,
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

          {/* Repeating Event Toggle - Moved Above Date/Time */}
          <div className="divider">Repeat Settings</div>
          
          <div className="form-control">
            <label className="label cursor-pointer">
              <span className="label-text">
                <RefreshCw className="w-4 h-4 mr-2 inline" />
                Repeating Event
              </span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={formData.isRepeating}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  isRepeating: e.target.checked,
                  repeatDays: e.target.checked ? formData.repeatDays : []
                })}
              />
            </label>
          </div>

          {formData.isRepeating && (
            <div>
              <label className="label">
                <span className="label-text">Repeat on days</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {dayNames.map((day, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`btn btn-sm ${
                      formData.repeatDays.includes(index) 
                        ? "btn-primary" 
                        : "btn-outline"
                    }`}
                    onClick={() => toggleRepeatDay(index)}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
              {formData.repeatDays.length === 0 && (
                <p className="text-sm text-error mt-1">
                  Please select at least one day for repeating events
                </p>
              )}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">
                <span className="label-text">
                  {formData.isRepeating ? "Start Date & Time (Repeat Period Start)" : "Start Time"}
                </span>
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
                <span className="label-text">
                  {formData.isRepeating ? "End Date & Time (Repeat Period End)" : "End Time"}
                </span>
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
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={formData.isRepeating && formData.repeatDays.length === 0}
            >
              Create Event
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
