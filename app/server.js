const express = require("express");
const { Pool } = require("pg");
const app = express();
app.use(express.json());
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432", 10),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});
async function ensureTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL);`);
}
app.get("/healthz", (req, res) => res.status(200).json({ status: "ok" }));
app.get("/ready", async (req, res) => {
  try { await pool.query("SELECT 1"); res.status(200).json({ status: "ready" }); }
  catch (err) { res.status(503).json({ status: "not ready", error: err.message }); }
});
app.get("/users", async (req, res) => {
  try { await ensureTable();
    const r = await pool.query("SELECT id, name, email FROM users ORDER BY id");
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/users", async (req, res) => {
  const { name, email } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: "name and email required" });
  try { await ensureTable();
    const r = await pool.query("INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email", [name, email]);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "email already exists" });
    res.status(500).json({ error: err.message });
  }
});
app.get("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "invalid id" });
  try {
    const r = await pool.query("SELECT id, name, email FROM users WHERE id = $1", [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "not found" });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "invalid id" });
  const { name, email } = req.body || {};
  try {
    const r = await pool.query(
      `UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email)
       WHERE id = $3 RETURNING id, name, email`, [name, email, id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "not found" });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: "invalid id" });
  try {
    const r = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "not found" });
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));