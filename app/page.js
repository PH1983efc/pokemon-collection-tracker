
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const API = "https://api.tcgdex.net/v2/en";

const variants = [
  "Normal",
  "Holo",
  "Reverse Holo",
  "Cosmos Holo",
  "First Edition",
  "1st Edition Holo",
  "Shiny",
  "Other",
];

export default function Home() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sets, setSets] = useState([]);
  const [selectedSet, setSelectedSet] = useState("");
  const [cards, setCards] = useState([]);
  const [owned, setOwned] = useState({});
  const [variant, setVariant] = useState("Normal");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setUser(data.session?.user ?? null);

      const { data: listener } = supabase.auth.onAuthStateChange(
        (_event, session) => setUser(session?.user ?? null)
      );

      try {
        const response = await fetch(`${API}/sets`);
        if (!response.ok) throw new Error("Unable to load sets.");
        const result = await response.json();
        if (active) setSets(result);
      } catch {
        if (active) setMessage("Couldn't load sets. Please refresh.");
      }

      if (active) setLoading(false);
      return listener;
    }

    init();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setOwned({});
      return;
    }

    async function loadOwned() {
      const { data, error } = await supabase
        .from("collected_cards")
        .select("card_id, variant, quantity")
        .eq("user_id", user.id);

      if (error) {
        setMessage("Couldn't load collection: " + error.message);
        return;
      }

      const next = {};
      for (const item of data ?? []) {
        const key = `${item.card_id}|${item.variant}`;
        next[key] = (next[key] ?? 0) + (item.quantity ?? 1);
      }
      setOwned(next);
    }

    loadOwned();
  }, [user]);

  async function signIn(event) {
    event.preventDefault();
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setMessage(error ? error.message : "Signed in successfully.");
  }

  async function signUp() {
    setMessage("");
    const { error } = await supabase.auth.signUp({ email, password });
    setMessage(
      error
        ? error.message
        : "Account created. Check your email if confirmation is required."
    );
  }

  async function loadSet(setId) {
    setSelectedSet(setId);
    setCards([]);
    setMessage("");
    if (!setId) return;

    try {
      const response = await fetch(`${API}/sets/${setId}`);
      if (!response.ok) throw new Error("Couldn't load this set.");
      const result = await response.json();
      setCards(result.cards ?? []);
    } catch (error) {
      setMessage(error.message || "Couldn't load this set.");
    }
  }

  async function changeQuantity(card, change) {
    if (!user) {
      setMessage("Please sign in to update your collection.");
      return;
    }

    const key = `${card.id}|${variant}`;
    const oldQuantity = owned[key] ?? 0;
    const newQuantity = Math.max(0, oldQuantity + change);

    if (newQuantity === oldQuantity) return;

    setSaving(key);
    setMessage("");

    try {
      const { data: rows, error: findError } = await supabase
        .from("collected_cards")
        .select("id, quantity")
        .eq("user_id", user.id)
        .eq("card_id", card.id)
        .eq("variant", variant);

      if (findError) throw findError;

      if (rows?.length) {
        const existing = rows[0];

        if (newQuantity === 0) {
          const { error } = await supabase
            .from("collected_cards")
            .delete()
            .eq("id", existing.id)
            .eq("user_id", user.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("collected_cards")
            .update({ quantity: newQuantity })
            .eq("id", existing.id)
            .eq("user_id", user.id);

          if (error) throw error;
        }

        for (const extra of rows.slice(1)) {
          const { error } = await supabase
            .from("collected_cards")
            .delete()
            .eq("id", extra.id)
            .eq("user_id", user.id);
          if (error) throw error;
        }
      } else if (newQuantity > 0) {
        const { error } = await supabase
          .from("collected_cards")
          .insert({
            user_id: user.id,
            card_id: card.id,
            set_name:
              sets.find((set) => set.id === selectedSet)?.name ??
              selectedSet,
            variant,
            quantity: newQuantity,
            condition: "Unknown",
          });

        if (error) throw error;
      }

      setOwned((current) => ({ ...current, [key]: newQuantity }));
    } catch (error) {
      setMessage("Couldn't save quantity: " + error.message);
    } finally {
      setSaving("");
    }
  }

  const totalOwned = Object.values(owned).reduce(
    (total, quantity) => total + quantity,
    0
  );

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <p style={styles.eyebrow}>YOUR PERSONAL COLLECTION</p>
        <h1 style={styles.title}>My Pokémon Binder</h1>
        <p style={styles.muted}>
          Browse real Pokémon cards and track every version you own.
        </p>

        {!user ? (
          <form onSubmit={signIn} style={styles.panel}>
            <input
              required
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={styles.input}
            />
            <input
              required
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={styles.input}
            />
            <button style={styles.button}>Sign in</button>
            <button type="button" onClick={signUp} style={styles.button}>
              Create account
            </button>
          </form>
        ) : (
          <section style={styles.panel}>
            <strong>Collection saved to your account</strong>
            <p style={styles.muted}>{user.email}</p>
            <p>{totalOwned} copies collected across all variants</p>
            <button
              onClick={() => supabase.auth.signOut()}
              style={styles.button}
            >
              Sign out
            </button>
          </section>
        )}

        {message && <p style={styles.message}>{message}</p>}

        <h2 style={styles.heading}>Choose a set</h2>
        <select
          value={selectedSet}
          onChange={(event) => loadSet(event.target.value)}
          style={{ ...styles.input, width: "100%" }}
        >
          <option value="">Select a Pokémon set…</option>
          {sets.map((set) => (
            <option key={set.id} value={set.id}>
              {set.name}
            </option>
          ))}
        </select>

        <h2 style={styles.heading}>Choose card variant</h2>
        <p style={styles.muted}>
          Select a version, then use + and − on each card to record how many
          copies you own.
        </p>
        <select
          value={variant}
          onChange={(event) => setVariant(event.target.value)}
          style={{ ...styles.input, width: "100%" }}
        >
          {variants.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        {loading && <p>Loading sets…</p>}

        {cards.length > 0 && (
          <>
            <h2 style={styles.heading}>
              {sets.find((set) => set.id === selectedSet)?.name} —{" "}
              {cards.length} cards
            </h2>

            <div style={styles.grid}>
              {cards.map((card) => {
                const key = `${card.id}|${variant}`;
                const quantity = owned[key] ?? 0;
                const imageUrl = card.image
                  ? `${card.image}/high.webp`
                  : "";

                return (
                  <article
                    key={card.id}
                    style={{
                      ...styles.card,
                      border: quantity
                        ? "3px solid #50d890"
                        : "2px solid #39445b",
                    }}
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={card.name}
                        loading="lazy"
                        style={styles.cardImage}
                      />
                    ) : (
                      <div style={styles.noImage}>Image unavailable</div>
                    )}

                    <div style={styles.cardNumber}>
                      #{card.localId ?? card.id}
                    </div>
                    <div style={styles.cardName}>{card.name}</div>
                    <div style={styles.muted}>
                      {card.rarity ?? "Rarity not listed"}
                    </div>

                    <div style={styles.quantityControls}>
                      <button
                        aria-label={`Remove one ${variant} ${card.name}`}
                        disabled={!user || quantity === 0 || saving === key}
                        onClick={() => changeQuantity(card, -1)}
                        style={styles.quantityButton}
                      >
                        −
                      </button>
                      <strong>{quantity}</strong>
                      <button
                        aria-label={`Add one ${variant} ${card.name}`}
                        disabled={!user || saving === key}
                        onClick={() => changeQuantity(card, 1)}
                        style={styles.quantityButton}
                      >
                        +
                      </button>
                    </div>

                    <div style={styles.ownedLabel}>
                      {quantity > 0
                        ? `${quantity} owned · ${variant}`
                        : `Not owned · ${variant}`}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#101522",
    color: "white",
    padding: "28px 16px",
    fontFamily: "Arial, sans-serif",
  },
  container: { maxWidth: 1100, margin: "0 auto" },
  eyebrow: { color: "#50d890", letterSpacing: 2, fontSize: 12 },
  title: { fontSize: "clamp(28px, 5vw, 42px)", marginBottom: 8 },
  heading: { marginTop: 28, marginBottom: 10 },
  muted: { color: "#b8c1d8", fontSize: 13 },
  message: { color: "#ffd166", overflowWrap: "anywhere" },
  panel: {
    background: "#202a40",
    padding: 18,
    borderRadius: 14,
    margin: "24px 0",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  input: {
    boxSizing: "border-box",
    padding: 12,
    borderRadius: 8,
    border: "1px solid #39445b",
    background: "#151d2d",
    color: "white",
    fontSize: 14,
  },
  button: {
    padding: "12px 16px",
    borderRadius: 8,
    border: 0,
    background: "#50d890",
    color: "#101522",
    fontWeight: "bold",
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginTop: 16,
  },
  card: {
    minWidth: 0,
    padding: 8,
    borderRadius: 12,
    background: "#202a40",
    textAlign: "center",
    overflow: "hidden",
  },
  cardImage: { width: "100%", display: "block", borderRadius: 8 },
  noImage: {
    aspectRatio: "3 / 4",
    display: "grid",
    placeItems: "center",
    color: "#b8c1d8",
  },
  cardNumber: { fontSize: 12, marginTop: 8 },
  cardName: { fontWeight: "bold", marginTop: 4, overflowWrap: "anywhere" },
  quantityControls: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    marginTop: 12,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    border: 0,
    background: "#39445b",
    color: "white",
    fontSize: 22,
    cursor: "pointer",
  },
  ownedLabel: { fontSize: 11, color: "#72f0ad", marginTop: 8 },
};
