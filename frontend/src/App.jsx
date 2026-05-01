import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_SERVER_URL = "http://localhost:5001";

function App() {
  const socketRef = useRef(null);
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const socket = io("https://chat-app-backend-xyz.onrender.com", {
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("receive_message", (incomingMessage) => {
      setChatMessages((previousMessages) => {
        const hasRecentLocalDuplicate = previousMessages.some((existingMessage) => {
          const sameSender = existingMessage.sender === incomingMessage.sender;
          const sameContent = existingMessage.content === incomingMessage.content;
          const isLocalTempId = String(existingMessage._id || "").startsWith("local-");
          return sameSender && sameContent && isLocalTempId;
        });

        if (hasRecentLocalDuplicate) {
          return previousMessages.map((existingMessage) => {
            const sameSender = existingMessage.sender === incomingMessage.sender;
            const sameContent = existingMessage.content === incomingMessage.content;
            const isLocalTempId = String(existingMessage._id || "").startsWith("local-");

            if (sameSender && sameContent && isLocalTempId) {
              return incomingMessage;
            }

            return existingMessage;
          });
        }

        return [...previousMessages, incomingMessage];
      });
    });

    socket.on("message_error", (errorMessage) => {
      setError(errorMessage);
    });

    return () => {
      socket.off("receive_message");
      socket.off("message_error");
      socket.off("connect");
      socket.off("disconnect");
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleJoinRoom = (event) => {
    event.preventDefault();

    if (!username.trim() || !roomId.trim()) {
      setError("Please enter both username and room ID.");
      return;
    }

    if (!socketRef.current?.connected) {
      setError("Socket not connected yet. Please wait a second and try again.");
      return;
    }

    socketRef.current.emit("join_room", roomId.trim());
    setHasJoinedRoom(true);
    setError("");
  };

  const handleSendMessage = (event) => {
    event.preventDefault();

    if (!message.trim()) {
      return;
    }

    const payload = {
      // Server currently expects a `sender` field.
      // We pass username for now so the beginner flow remains simple.
      sender: username.trim(),
      roomId: roomId.trim(),
      content: message.trim(),
    };

    // Optimistic update: show message immediately in sender UI.
    // Server will still broadcast to room members for realtime sync.
    setChatMessages((previousMessages) => [
      ...previousMessages,
      {
        _id: `local-${Date.now()}`,
        sender: payload.sender,
        roomId: payload.roomId,
        content: payload.content,
        timestamp: new Date().toISOString(),
      },
    ]);

    socketRef.current?.emit("send_message", payload);
    setMessage("");
  };

  if (!hasJoinedRoom) {
    return (
      <main className="page">
        <section className="card login-card">
          <h1>Realtime Chat</h1>
          <p className="subtitle">Join a room to start chatting instantly.</p>
          <form className="login-form" onSubmit={handleJoinRoom}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. Rudra"
              autoComplete="off"
            />
            <label htmlFor="roomId">Room ID</label>
            <input
              id="roomId"
              type="text"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              placeholder="e.g. team-general"
              autoComplete="off"
            />
            {error ? <p className="error">{error}</p> : null}
            <button type="submit">Enter Chat</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card chat-card">
        <header className="chat-header">
          <div>
            <h2>Room: {roomId}</h2>
            <p>Logged in as {username}</p>
            <p>{isConnected ? "Socket connected" : "Socket disconnected"}</p>
          </div>
        </header>

        <div className="messages">
          {chatMessages.length === 0 ? (
            <p className="empty-state">No messages yet. Say hello!</p>
          ) : (
            chatMessages.map((chatMessage) => (
              <article className="message" key={chatMessage._id || chatMessage.timestamp}>
                <p className="meta">
                  <strong>{chatMessage.sender}</strong>{" "}
                  <span>
                    {new Date(chatMessage.timestamp || Date.now()).toLocaleTimeString()}
                  </span>
                </p>
                <p>{chatMessage.content}</p>
              </article>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="message-form" onSubmit={handleSendMessage}>
          <input
            type="text"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Type your message..."
            autoComplete="off"
          />
          <button type="submit">Send</button>
        </form>
      </section>
    </main>
  );
}

export default App;
