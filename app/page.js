
"use client";

import { useState } from "react";

const pokemon = [
  { id: 1, name: "Bulbasaur", number: "001", color: "#78c850" },
  { id: 2, name: "Ivysaur", number: "002", color: "#78c850" },
  { id: 3, name: "Venusaur", number: "003", color: "#78c850" },
  { id: 4, name: "Charmander", number: "004", color: "#f08030" },
  { id: 5, name: "Charmeleon", number: "005", color: "#f08030" },
  { id: 6, name: "Charizard", number: "006", color: "#f08030" },
  { id: 7, name: "Squirtle", number: "007", color: "#6890f0" },
  { id: 8, name: "Wartortle", number: "008", color: "#6890f0" },
  { id: 9, name: "Blastoise", number: "009", color: "#6890f0" },
];

export default function Home() {
  const [collected, setCollected] = useState([]);

  function toggleCard(id) {
    setCollected((current) =>
      current.includes(id)
        ? current.filter((cardId) => cardId !== id)
        : [...current, id]
    );
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#101522",
      color: "white",
      padding: "28px 16px",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{ maxWidth: 850, margin: "0 auto" }}>
        <p style={{ color: "#9ca9c5", letterSpacing: 3, fontSize: 12 }}>
          YOUR PERSONAL POKÉMON COLLECTION
        </p>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 42px)", marginBottom: 8 }}>
          My Pokémon Binder
        </h1>
        <p style={{ color: "#b8c1d8" }}>
          Tap a card to mark it as collected.
        </p>

        <section style={{
          background: "#202a40",
          padding: 18,
          borderRadius: 16,
          margin: "24px 0"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <strong>First 9 Pokémon</strong>
            <strong>{collected.length} / {pokemon.length} collected</strong>
          </div>
          <div style={{
            height: 8,
            background: "#39445b",
            borderRadius: 10,
            marginTop: 14,
            overflow: "hidden"
          }}>
            <div style={{
              height: "100%",
              width: `${collected.length / pokemon.length * 100}%`,
              background: "#50d890",
              transition: "width 0.2s"
            }} />
          </div>
        </section>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12
        }}>
          {pokemon.map((card) => {
            const owned = collected.includes(card.id);
            return (
              <button
                key={card.id}
                onClick={() => toggleCard(card.id)}
                aria-pressed={owned}
                style={{
                  position: "relative",
                  minWidth: 0,
                  border: owned ? "3px solid #50d890" : "2px solid #39445b",
                  borderRadius: 12,
                  padding: 8,
                  background: owned ? "#244b3d" : "#202a40",
                  color: "white",
                  cursor: "pointer",
                  textAlign: "center",
                  opacity: owned ? 1 : 0.8
                }}
              >
                <div style={{
                  aspectRatio: "3 / 4",
                  borderRadius: 8,
                  background: `linear-gradient(145deg, ${card.color}, #202a40)`,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 8,
                  padding: 4
                }}>
                  <span style={{ fontSize: "clamp(32px, 8vw, 58px)" }}>
                    {["🌱", "🌿", "🌳", "🔥", "🦎", "🐉", "💧", "🐢", "🌊"][card.id - 1]}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: "bold" }}>
                    #{card.number}
                  </span>
                </div>
                <div style={{ fontWeight: "bold", marginTop: 10, fontSize: "clamp(11px, 2.5vw, 15px)" }}>
                  {card.name}
                </div>
                <div style={{ fontSize: 11, marginTop: 5, color: owned ? "#72f0ad" : "#b8c1d8" }}>
                  {owned ? "✓ COLLECTED" : "NOT COLLECTED"}
                </div>
              </button>
            );
          })}
        </div>

        <p style={{ color: "#8995ad", fontSize: 12, marginTop: 24 }}>
          Prototype · Collection progress currently resets when the page reloads.
        </p>
      </div>
    </main>
  );
}
