
export const metadata = {
  title: "My Pokémon Binder",
  description: "Track your Pokémon card collection in a digital binder.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
