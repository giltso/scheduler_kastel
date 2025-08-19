import { convexQuery } from "@convex-dev/react-query";
import { useMutation } from "convex/react";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Authenticated } from "convex/react";
import { CheckCircle, XCircle, Clock, User, Calendar } from "lucide-react";
import { api } from "../../convex/_generated/api";

const currentUserQuery = convexQuery(api.users.getCurrentUser, {});

export const Route = createFileRoute("/approvals")({
  component: ApprovalsPage,
});

function ApprovalsPage() {
  return (
    <div className="not-prose">
      <Authenticated>
        <ApprovalsApp />
      </Authenticated>
    </div>
  );
}

function ApprovalsApp() {
  const { data: currentUser, isLoading } = useSuspenseQuery(currentUserQuery);

  if (isLoading || !currentUser) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="loading loading-spinner loading-lg"></div>
        <span className="ml-2">Loading approvals...</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Clock className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-bold">Approvals</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <User className="w-5 h-5" />
          <span>{currentUser.name}</span>
          {currentUser.role === "manager" && <div className="badge badge-secondary">Manager</div>}
        </div>
      </div>

      {currentUser.role === "manager" ? (
        <ManagerApprovalsView />
      ) : (
        <UserApprovalsView currentUser={currentUser} />
      )}
    </div>
  );
}

function UserApprovalsView({ currentUser: _ }: { currentUser: any }) {
  const pendingEventsQuery = convexQuery(api.events.getUserPendingEvents, {});
  const { data: pendingEvents, error } = useQuery(pendingEventsQuery);

  if (error) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold mb-2">Approvals Feature Loading</h2>
        <p className="text-base-content/70">
          The approvals feature is being deployed. Please refresh the page in a moment.
        </p>
      </div>
    );
  }

  if (!pendingEvents) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="loading loading-spinner loading-lg"></div>
        <span className="ml-2">Loading your pending events...</span>
      </div>
    );
  }

  if (pendingEvents.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">All caught up!</h2>
        <p className="text-base-content/70">You have no events pending approval.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        Your Events Pending Approval ({pendingEvents.length})
      </h2>
      <div className="space-y-4">
        {pendingEvents.map((event) => (
          <div key={event._id} className="card card-bordered bg-base-100 shadow-sm">
            <div className="card-body">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="card-title text-lg">{event.title}</h3>
                  <p className="text-base-content/70 mb-2">{event.description}</p>
                  <div className="flex items-center gap-4 text-sm text-base-content/60">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(event.startTime).toLocaleDateString()} at{" "}
                        {new Date(event.startTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      <span>Assigned to: {event.assignedUser?.name}</span>
                    </div>
                  </div>
                </div>
                <div className="badge badge-warning">Pending</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManagerApprovalsView() {
  const pendingEventsQuery = convexQuery(api.events.getPendingEvents, {});
  const { data: pendingEvents } = useSuspenseQuery(pendingEventsQuery);
  const approveEvent = useMutation(api.events.approveEvent);
  const rejectEvent = useMutation(api.events.rejectEvent);

  const handleApprove = async (eventId: any) => {
    try {
      await approveEvent({ eventId });
    } catch (error) {
      console.error("Failed to approve event:", error);
    }
  };

  const handleReject = async (eventId: any) => {
    try {
      await rejectEvent({ eventId });
    } catch (error) {
      console.error("Failed to reject event:", error);
    }
  };

  if (pendingEvents.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">All caught up!</h2>
        <p className="text-base-content/70">No events require your approval.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">
        Events Requiring Approval ({pendingEvents.length})
      </h2>
      <div className="space-y-4">
        {pendingEvents.map((event) => (
          <div key={event._id} className="card card-bordered bg-base-100 shadow-sm">
            <div className="card-body">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="card-title text-lg">{event.title}</h3>
                  <p className="text-base-content/70 mb-2">{event.description}</p>
                  <div className="flex items-center gap-4 text-sm text-base-content/60">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(event.startTime).toLocaleDateString()} at{" "}
                        {new Date(event.startTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      <span>Created by: {event.creator?.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      <span>Assigned to: {event.assignedUser?.name}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="badge badge-warning">Pending</div>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => void handleApprove(event._id)}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      className="btn btn-error btn-sm"
                      onClick={() => void handleReject(event._id)}
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}