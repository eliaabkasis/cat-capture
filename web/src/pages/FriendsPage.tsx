import { useEffect, useState } from "react";
import type { FriendRequest, FriendUser } from "../types";
import {
  FriendRequestError,
  acceptRequest,
  cancelRequest,
  declineRequest,
  fetchFriends,
  fetchFriendSightings,
  fetchIncomingRequests,
  fetchOutgoingRequests,
  removeFriend,
  sendFriendRequest,
} from "../api/friends";
import { computeDailyStreak } from "../stats";
import styles from "./FriendsPage.module.css";

const ERROR_MESSAGES: Record<string, string> = {
  missing_email: "Enter an email address.",
  user_not_found: "No one with that email has signed up yet.",
  cannot_friend_self: "That's your own email.",
  already_friends: "You're already friends.",
  already_requested: "You already sent this person a request.",
};

interface FriendsPageProps {
  onBack: () => void;
  onOpenFriend: (friend: FriendUser) => void;
}

export function FriendsPage({ onBack, onOpenFriend }: FriendsPageProps) {
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchFriends()
      .then((loadedFriends) => {
        setFriends(loadedFriends);
        loadedFriends.forEach((friend) => {
          fetchFriendSightings(friend.id)
            .then((sightings) => {
              setStreaks((prev) => ({ ...prev, [friend.id]: computeDailyStreak(sightings) }));
            })
            .catch(() => {});
        });
      })
      .catch(() => setFriends([]));
    fetchIncomingRequests()
      .then(setIncoming)
      .catch(() => setIncoming([]));
    fetchOutgoingRequests()
      .then(setOutgoing)
      .catch(() => setOutgoing([]));
  }, [refreshKey]);

  function refresh() {
    setRefreshKey((key) => key + 1);
  }

  async function handleSendRequest(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMessage(null);
    try {
      await sendFriendRequest(email.trim());
      setEmail("");
      setMessage({ kind: "success", text: "Friend request sent." });
      refresh();
    } catch (err) {
      const code = err instanceof FriendRequestError ? err.code : "";
      setMessage({ kind: "error", text: ERROR_MESSAGES[code] ?? "Couldn't send that request." });
    } finally {
      setSending(false);
    }
  }

  async function handleAccept(id: string) {
    await acceptRequest(id);
    refresh();
  }

  async function handleDecline(id: string) {
    await declineRequest(id);
    refresh();
  }

  async function handleCancel(id: string) {
    await cancelRequest(id);
    refresh();
  }

  async function handleRemove(userId: string) {
    await removeFriend(userId);
    setConfirmingRemove(null);
    refresh();
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.backButton} onClick={onBack} aria-label="Back to home">
          ←
        </button>
        <h1 className={styles.title}>Friends</h1>
      </div>

      <form className={styles.addForm} onSubmit={handleSendRequest}>
        <input
          className={styles.emailInput}
          type="email"
          placeholder="Friend's email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button className={styles.sendButton} type="submit" disabled={sending}>
          {sending ? "Sending…" : "Send request"}
        </button>
      </form>

      {message && (
        <p className={message.kind === "error" ? styles.errorText : styles.successText}>
          {message.text}
        </p>
      )}

      {incoming.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Requests</h2>
          {incoming.map((request) => (
            <div className={styles.row} key={request.id}>
              <span className={styles.rowName}>{request.user.name ?? request.user.email}</span>
              <div className={styles.rowActions}>
                <button className={styles.acceptButton} onClick={() => handleAccept(request.id)}>
                  Accept
                </button>
                <button className={styles.declineButton} onClick={() => handleDecline(request.id)}>
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {outgoing.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Pending</h2>
          {outgoing.map((request) => (
            <div className={styles.row} key={request.id}>
              <span className={styles.rowName}>{request.user.name ?? request.user.email}</span>
              <div className={styles.rowActions}>
                <span className={styles.pendingLabel}>Pending</span>
                <button className={styles.declineButton} onClick={() => handleCancel(request.id)}>
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Your friends</h2>
        {friends.length === 0 ? (
          <p className={styles.empty}>No friends yet — send a request above.</p>
        ) : (
          friends.map((friend) => (
            <div className={styles.row} key={friend.id}>
              <button className={styles.friendButton} onClick={() => onOpenFriend(friend)}>
                {friend.pictureUrl && (
                  <img className={styles.avatar} src={friend.pictureUrl} alt="" referrerPolicy="no-referrer" />
                )}
                <span className={styles.rowName}>{friend.name ?? friend.email}</span>
                <span className={styles.streak}>{streaks[friend.id] ?? 0} day streak</span>
              </button>
              <div className={styles.rowActions}>
                {confirmingRemove === friend.id ? (
                  <>
                    <button className={styles.declineButton} onClick={() => handleRemove(friend.id)}>
                      Confirm
                    </button>
                    <button
                      className={styles.pendingLabel}
                      onClick={() => setConfirmingRemove(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className={styles.declineButton}
                    onClick={() => setConfirmingRemove(friend.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
