
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const API = "https://api.tcgdex.net/v2/en";

export default function Home() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sets, setSets] = useState([]);
  const [selectedSet, setSelectedSet] = useState("");
  const [cards, setCards] = useState([]);
  const [owned, setOwned] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [variant, setVariant] = useState("Normal");

  useEffect(() => {
    let active = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      setUser(data.session?.user ?? null);

      const { data: authData } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          setUser(session?.user ?? null);
        }
      );

      try {
        const response = await fetch(`${API}/sets`);
        const result = await response.json();
        if (active) setSets(result);
      } catch {
        if (active) setMessage("Couldn't load sets. Please refresh and try again.");
      }

      if (active) setLoading(false);

      return () => authData.subscription.unsubscribe();
    }

    init();

    return () => { active = false; };
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
        setMessage("Couldn't load your collection: " + error.message);
        return;
      }

      const next = {};
      for (const item of data ?? []) {
        next[`${item.card_id}|${item.variant}`] = item.quantity;
      }
      setOwned(next);
    }

    loadOwned();
  }, [user]);

  async function signIn(event) {
    event.preventDefault();
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : "Signed in!");
  }

  async function signUp() {
    setMessage("");
    const { error } = await supabase.auth.signUp({ email, password });
    setMessage(error ? error.message : "Account created. Check your email if confirmation is required.");
  }

  async function loadSet(setId) {
    setSelectedSet(setId);
    setCards([]);
    setMessage("");

    try {
      const response = await fetch(`${API}/sets/${setId}`);
      if (!response.ok) throw new Error("Set could not be loaded.");
      const result = await response.json();
      setCards(result.cards ?? []);

      const { data } = await supabase
        .from("pokemon_sets")
        .select("set_id")
        .eq("set_id", setId)
        .maybeSingle();

      if (!data) {
        await supabase.from("pokemon_sets").insert({
          set_id: setId,
          set_name: result.name,
          series: result.serie?.name ?? "",
          release_date: result.releaseDate || null,
          total_cards: result.cardCount?.total ?? result.cards?.length ?? 0,
        });
      }
    } catch (error) {
      setMessage(error.message || "Couldn't load this set.");
    }
  }

  async function toggleCard(card) {
    if (!user) {
      setMessage("Please sign in before adding cards to your collection.");
      return;
    }

    const key = `${card.id}|${variant}`;
    const quantity = owned[key] ? 0 : 1;

    if (quantity === 0) {
      const { error } = await supabase
        .from("collected_cards")
        .delete()
        .eq("user_id", user.id)
        .eq("card_id", card.id)
        .eq("variant", variant);

      if (error) {
        setMessage(error.message);
        return;
      }

      setOwned((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    } else {
      const { error } = await supabase.from("collected_cards").insert({
        user_id: user.id,
        card_id: card.id,
        set_name: sets.find((s) => s.id === selectedSet)?.name ?? selectedSet,
        variant,
        quantity: 1,
        condition: "Unknown",
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setOwned((current) => ({ ...current, [key]: 1 }));
    }
  }

  const collectedCount = Object.values(owned).filter((q) => q > 0).length;

  return (
    <main style={{ minHeight: "100vh", background: "#101522", color: "white", padding: 20, fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "auto" }}>
        <p style={{ color: "#50d890", letterSpacing: 2, fontSize: 12 }}>YOUR PERSONAL COLLECTION</p>
        <h1 style={{ fontSize: 36, marginBottom: 8 }}>My Pokémon Binder</h1>
        <p style={{ color: "#b8c1d8" }}>Browse sets, view real card images and track your collection.</p>

        {!user ? (
          <form onSubmit={signIn} style={{ background: "#202a40", padding: 18, borderRadius: 12, margin: "24px 0", display: "flex", flexWrap: "wrap", gap: 10 }}>
            <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            <input required type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />
            <button style={buttonStyle}>Sign in</button>
            <button type="button" onClick={signUp} style={buttonStyle}>Create account</button>
          </form>
        ) : (
          <section style={{ background: "#202a40", padding: 16, borderRadius: 12, margin: "24px 0" }}>
            Signed in as <strong>{user.email}</strong>
            <button onClick={() => supabase.auth.signOut()} style={{ ...buttonStyle, marginLeft: 12 }}>Sign out</button>
            <p>{collectedCount} card variants collected</p>
          </section>
        )}

        {message && <p style={{ color: "#ffd166" }}>{message}</p>}

        <label htmlFor="set" style={{ display: "block", marginBottom: 8 }}>Choose a Pokémon set</label>
        <select id="set" value={selectedSet} onChange={(e) => loadSet(e.target.value)} style={{ ...inputStyle, width: "100%", maxWidth: 500 }}>
          <option value="">Select a set…</option>
          {sets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}
        </select>

        <div style={{ margin: "18px 0" }}>
          <label htmlFor="variant">Variant to track: </label>
          <select id="variant" value={variant} onChange={(e) => setVariant(e.target.value)} style={inputStyle}>
            {["Normal", "Holo", "Reverse Holo", "First Edition", "Other"].map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>

        {loading && <p>Loading sets…</p>}
        {!loading && sets.length === 0 && <p>No sets loaded. Please refresh to try again.</p>}

        {cards.length > 0 && (
          <>
            <h2>{sets.find((s) => s.id === selectedSet)?.name} — {cards.length} cards</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              {cards.map((card) => {
                const key = `${card.id}|${variant}`;
                const isOwned = Boolean(owned[key]);
                const imageUrl = card.image ? `${card.image}/high.webp` : "";
                return (
                  <button key={card.id} onClick={() => toggleCard(card)} style={{ minWidth: 0, padding: 8, borderRadius: 12, border: isOwned ? "3px solid #50d890" : "2px solid #39445b", background: isOwned ? "#244b3d" : "#202a40", color: "white", cursor: "pointer" }}>
                    {imageUrl ? (
                      <img src={imageUrl} alt={card.name} loading="lazy" style={{ width: "100%", display: "block", borderRadius: 8 }} />
                    ) : (
                      <div style={{ aspectRatio: "3 / 4", display: "grid", placeItems: "center" }}>Image unavailable</div>
                    )}
                    <div style={{ fontWeight: "bold", marginTop: 8 }}>{card.localId ?? card.id}</div>
                    <div>{card.name}</div>
                    <div style={{ color: isOwned ? "#72f0ad" : "#b8c1d8", fontSize: 12, marginTop: 6 }}>
                      {isOwned ? "✓ COLLECTED" : "＋ ADD TO COLLECTION"}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const inputStyle = {
  padding: 12,
  borderRadius: 8,
  border: "1px solid #39445b",
  background: "#151d2d",
  color: "white",
  fontSize: 14,
};

const buttonStyle = {
  padding: "12px 16px",
  borderRadius: 8,
  border: 0,
  background: "#50d890",
  color: "#101522",
  fontWeight: "bold",
  cursor: "pointer",
};
