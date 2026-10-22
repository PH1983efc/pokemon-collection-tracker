
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const API = "https://api.tcgdex.net/v2/en";

const variantLabels = {
  normal: "Normal",
  holo: "Holo",
  reverse: "Reverse Holo",
  firstEdition: "First Edition",
  wPromo: "W Promo",
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "#101522",
    color: "white",
    padding: "24px 16px",
    fontFamily: "Arial, sans-serif",
  },
  container: { maxWidth: 1100, margin: "auto" },
  muted: { color: "#b8c1d8", fontSize: 13 },
  panel: {
    background: "#202a40",
    padding: 18,
    borderRadius: 14,
    margin: "20px 0",
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
    padding: "10px 14px",
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
    marginTop: 18,
  },
  card: {
    minWidth: 0,
    padding: 8,
    borderRadius: 12,
    background: "#202a40",
    color: "white",
    textAlign: "center",
    cursor: "pointer",
    overflow: "hidden",
  },
  image: { width: "100%", display: "block", borderRadius: 8 },
  quantityButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    border: "1px solid #526079",
    background: "#303c54",
    color: "white",
    fontSize: 22,
    cursor: "pointer",
  },
};

export default function Home() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sets, setSets] = useState([]);
  const [selectedSet, setSelectedSet] = useState("");
  const [cards, setCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [cardDetails, setCardDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [owned, setOwned] = useState({});
  const [saving, setSaving] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      setUser(data.session?.user ?? null);

      try {
        const response = await fetch(`${API}/sets`);
        if (!response.ok) throw new Error("Could not load sets.");

        const result = await response.json();

        result.sort((a, b) => {
          const dateA = a.releaseDate || "";
          const dateB = b.releaseDate || "";
          return (
            dateB.localeCompare(dateA) ||
            (a.name || "").localeCompare(b.name || "")
          );
        });

        if (active) setSets(result);
      } catch (error) {
        if (active) setMessage(error.message);
      }

      if (active) setLoading(false);
    }

    init();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setOwned({});
      return;
    }

    let active = true;

    async function loadOwned() {
      const { data, error } = await supabase
        .from("collected_cards")
        .select("card_id, variant, quantity")
        .eq("user_id", user.id);

      if (!active) return;

      if (error) {
        setMessage("Couldn't load your collection: " + error.message);
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

    return () => {
      active = false;
    };
  }, [user]);

  async function signIn(event) {
    event.preventDefault();
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) setMessage(error.message);
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
    setSelectedCard(null);
    setCardDetails(null);
    setMessage("");

    if (!setId) return;

    try {
      const response = await fetch(`${API}/sets/${setId}`);
      if (!response.ok) throw new Error("Couldn't load this set.");

      const result = await response.json();
      setCards(result.cards ?? []);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function openCard(card) {
    if (selectedCard?.id === card.id) {
      setSelectedCard(null);
      setCardDetails(null);
      return;
    }

    setSelectedCard(card);
    setCardDetails(null);
    setDetailLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${API}/cards/${card.id}`);
      if (!response.ok) throw new Error("Couldn't load card details.");

      const details = await response.json();
      setCardDetails(details);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setDetailLoading(false);
    }
  }

  function getAvailableVariants(card) {
    const flags = card?.variants;

    if (!flags || typeof flags !== "object") return null;

    return Object.entries(variantLabels)
      .filter(([key]) => flags[key] === true)
      .map(([key, label]) => ({ key, label }));
  }

  async function changeQuantity(card, variant, change) {
    if (!user) {
      setMessage("Please sign in to update your collection.");
      return;
    }

    const key = `${card.id}|${variant}`;
    const oldQuantity = owned[key] ?? 0;
    const newQuantity = Math.max(0, oldQuantity + change);

    if (oldQuantity === newQuantity) return;

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

      setOwned((current) => ({
        ...current,
        [key]: newQuantity,
      }));
    } catch (error) {
      setMessage("Couldn't save your card: " + error.message);
    } finally {
      setSaving("");
    }
  }

  const totalCopies = Object.values(owned).reduce(
    (total, quantity) => total + quantity,
    0
  );

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <p style={{ color: "#50d890", letterSpacing: 2, fontSize: 12 }}>
          YOUR PERSONAL COLLECTION
        </p>

        <h1 style={{ fontSize: "clamp(28px, 5vw, 42px)", marginBottom: 8 }}>
          My Pokémon Binder
        </h1>

        <p style={styles.muted}>
          Browse every card in a set and manage its available versions.
        </p>

        {!user ? (
          <form
            onSubmit={signIn}
            style={{
              ...styles.panel,
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
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

            <button
              type="button"
              onClick={signUp}
              style={styles.button}
            >
              Create account
            </button>
          </form>
        ) : (
          <section style={styles.panel}>
            <strong>Collection saved to your account</strong>
            <p style={styles.muted}>{user.email}</p>
            <p>{totalCopies} copies owned across all tracked versions</p>
            <button
              onClick={() => supabase.auth.signOut()}
              style={styles.button}
            >
              Sign out
            </button>
          </section>
        )}

        {message && (
          <p style={{ color: "#ffd166", overflowWrap: "anywhere" }}>
            {message}
          </p>
        )}

        <h2 style={{ marginTop: 28 }}>Choose a set</h2>

        <select
          value={selectedSet}
          onChange={(event) => loadSet(event.target.value)}
          style={{ ...styles.input, width: "100%" }}
        >
          <option value="">Select a set — newest first</option>
          {sets.map((set) => (
            <option key={set.id} value={set.id}>
              {set.releaseDate
                ? `${set.name} (${set.releaseDate})`
                : `${set.name} (date unknown)`}
            </option>
          ))}
        </select>

        {loading && <p>Loading sets…</p>}

        {selectedSet && cards.length > 0 && (
          <>
            <h2 style={{ marginTop: 28 }}>
              {sets.find((set) => set.id === selectedSet)?.name}
            </h2>
            <p style={styles.muted}>
              {cards.length} cards · Select a card to view its versions and
              quantities.
            </p>

            <div style={styles.grid}>
              {cards.map((card) => {
                const total = Object.entries(owned)
                  .filter(([key]) => key.startsWith(`${card.id}|`))
                  .reduce((sum, [, quantity]) => sum + quantity, 0);

                const isSelected = selectedCard?.id === card.id;
                const imageUrl = card.image
                  ? `${card.image}/high.webp`
                  : "";

                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => openCard(card)}
                    aria-expanded={isSelected}
                    style={{
                      ...styles.card,
                      border: isSelected
                        ? "3px solid #78aaff"
                        : total > 0
                          ? "3px solid #50d890"
                          : "2px solid #39445b",
                    }}
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={card.name}
                        loading="lazy"
                        style={styles.image}
                      />
                    ) : (
                      <div
                        style={{
                          aspectRatio: "3 / 4",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        Image unavailable
                      </div>
                    )}

                    <div style={{ fontWeight: "bold", marginTop: 8 }}>
                      {card.name}
                    </div>
                    <div style={styles.muted}>#{card.localId}</div>

                    <div
                      style={{
                        fontSize: 12,
                        color: total > 0 ? "#72f0ad" : "#b8c1d8",
                        marginTop: 8,
                      }}
                    >
                      {total > 0 ? `${total} owned` : "Not collected"}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {selectedCard && (
          <section style={{ ...styles.panel, marginTop: 28 }}>
            <button
              type="button"
              onClick={() => {
                setSelectedCard(null);
                setCardDetails(null);
              }}
              style={{ ...styles.button, marginBottom: 16 }}
            >
              Close card details
            </button>

            <h2>{selectedCard.name}</h2>
            <p style={styles.muted}>
              Card #{selectedCard.localId} ·{" "}
              {cardDetails?.rarity ?? "Loading card information…"}
            </p>

            {detailLoading && <p>Checking available versions…</p>}

            {cardDetails && (() => {
              const available = getAvailableVariants(cardDetails);

              if (available === null) {
                return (
                  <p style={styles.muted}>
                    Version information isn't available for this card yet.
                    We won't assume that it has every version.
                  </p>
                );
              }

              if (available.length === 0) {
                return (
                  <p style={styles.muted}>
                    The catalogue doesn't list any confirmed versions for
                    this card. We won't invent variants.
                  </p>
                );
              }

              return (
                <>
                  <h3>Available versions</h3>
                  <p style={styles.muted}>
                    Record the quantity you own for each listed version.
                  </p>

                  {available.map((item) => {
                    const key = `${selectedCard.id}|${item.label}`;
                    const quantity = owned[key] ?? 0;
                    const busy = saving === key;

                    return (
                      <div
                        key={item.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 12,
                          padding: "12px 0",
                          borderBottom: "1px solid #39445b",
                        }}
                      >
                        <div>
                          <strong>{item.label}</strong>
                          <div style={styles.muted}>
                            {quantity > 0
                              ? `${quantity} owned`
                              : "Not collected"}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                          }}
                        >
                          <button
                            type="button"
                            aria-label={`Remove one ${item.label}`}
                            disabled={!user || quantity === 0 || busy}
                            onClick={() =>
                              changeQuantity(
                                selectedCard,
                                item.label,
                                -1
                              )
                            }
                            style={{
                              ...styles.quantityButton,
                              opacity:
                                !user || quantity === 0 || busy ? 0.4 : 1,
                            }}
                          >
                            −
                          </button>

                          <strong style={{ minWidth: 20, textAlign: "center" }}>
                            {quantity}
                          </strong>

                          <button
                            type="button"
                            aria-label={`Add one ${item.label}`}
                            disabled={!user || busy}
                            onClick={() =>
                              changeQuantity(
                                selectedCard,
                                item.label,
                                1
                              )
                            }
                            style={{
                              ...styles.quantityButton,
                              opacity: !user || busy ? 0.4 : 1,
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </section>
        )}
      </div>
    </main>
  );
}
