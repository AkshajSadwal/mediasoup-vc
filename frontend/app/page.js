'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');

  const createRoom = () => {
    const newRoomId = crypto.randomUUID();
    router.push(`/room/${newRoomId}`);
  };

  const joinRoom = () => {
    if (!roomId.trim()) return;

    router.push(`/room/${roomId}`);
  };

  return (
    <div className="container">
      <div className="card">
        <h1>Video Meeting</h1>

        <button
          className="btn create"
          onClick={createRoom}
        >
          Create New Room
        </button>

        <div className="divider">
          OR
        </div>

        <input
          type="text"
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) =>
            setRoomId(e.target.value)
          }
          className="input"
        />

        <button
          className="btn join"
          onClick={joinRoom}
        >
          Join Room
        </button>
      </div>
    </div>
  );
}