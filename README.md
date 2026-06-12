# EGYM Tracker — Projekt-Dokumentation & Session-Log

Dieses Dokument dient als Gedächtnis für zukünftige KI-Sessions. **Bitte zuerst lesen, bevor neuer Code geschrieben wird.**

---

## Technischer Stack

| Schicht | Technologie |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Plain CSS mit CSS-Variablen (`app/globals.css`), kein Tailwind |
| Icons | Lucide React |
| Charts | Recharts |
| Backend/DB | Supabase (PostgreSQL + Row Level Security + Auth) |
| Hosting | Vercel (Auto-Deploy via GitHub) |
| URL | https://egym-gpt.vercel.app |

---

## Datenbankstruktur (Supabase)

### Tabellen

| Tabelle | Wichtige Spalten |
|---|---|
| `profiles` | `id` (= auth.uid), `display_name`, `first_name`, `last_name`, `nickname`, `language` (de/en/ru), `role` |
| `exercises` | `id`, `name`, `muscle_group`, `type` ('egym'), `egym_order` |
| `workouts` | `id`, `user_id`, `start_time`, `status` ('active'/'completed'), `completed_at` |
| `sets` | `id`, `workout_id`, `exercise_id`, `weight_kg`, `reps`, `round_number`, `created_at` |
| `max_lifts` | `id`, `user_id`, `exercise_id`, `weight_kg`, `updated_at` — UNIQUE (user_id, exercise_id) |

### Unique Constraint (wichtig für UPSERT)
```
sets: UNIQUE (workout_id, exercise_id, round_number)
max_lifts: UNIQUE (user_id, exercise_id)
```

### RLS
Alle Tabellen haben RLS aktiviert. `sets` wird über `workouts.user_id` gesichert (kein direktes `user_id` auf `sets`).

### Ausgeführte Migrationen
- `supabase/migrations/001_training_refactor.sql` — workouts.status, sets Unique Constraint, max_lifts Tabelle + RLS, auto_complete_workouts() Funktion
- `supabase/migrations/002_profile_fields.sql` — first_name, last_name, nickname, language Spalten

---

## Architektur-Entscheidungen

- **Kein API-Layer** — Supabase wird direkt aus Client-Komponenten aufgerufen (`'use client'`), RLS übernimmt die Sicherheit.
- **Keine middleware.ts** — Next.js 16 nutzt `proxy.ts` statt `middleware.ts` für Auth-Schutz der Routen.
- **Sprache via React Context** — `lib/LanguageContext.tsx` stellt `useLang()` bereit; localStorage und Supabase `profiles.language` sind die Persistenz-Ebenen. `lib/i18n.ts` enthält alle Übersetzungen (DE/EN/RU).
- **Theme** — Hell-Modus ist Default. `data-theme` wird per Inline-Script in `layout.tsx` gesetzt (kein Flicker). Toggle im Profil, gespeichert in localStorage.
- **Auto-Save** — Trainings-Sets werden `onBlur` per `upsert` gespeichert (idempotent durch Unique Constraint). Kein manuelles Speichern nötig.
- **Auto-Complete Workouts** — Beim Öffnen der Training-Seite werden aktive Workouts vom Vortag automatisch auf `completed` gesetzt (app-seitig, kein Cron nötig).

---

## Routen-Übersicht

| Route | Typ | Beschreibung |
|---|---|---|
| `/login` | public | E-Mail/Passwort Login, Sprachauswahl |
| `/register` | public | Registrierung mit Vorname/Nachname/Nickname |
| `/forgot-password` | public | Passwort-Reset per E-Mail (Supabase) — **noch nicht implementiert** |
| `/reset-password` | public | Neues Passwort setzen — **noch nicht implementiert** |
| `/` | protected | Home/Dashboard |
| `/training` | protected | EGYM Zirkel (8 Geräte, 3 Runden) |
| `/classic` | protected | Klassisches Training — UI vorhanden, Supabase-Anbindung fehlt noch |
| `/analyse` | protected | Balkendiagramm Kraftentwicklung |
| `/profil` | protected | Profildaten, Sprache, Erscheinungsbild |

---

## Feature-Status

### Fertig und deployed
- Auth (Login, Register, Logout) mit Supabase
- EGYM Zirkeltraining: 1 Oberfläche, horizontales Grid Max Kraft | R1 | R2 | R3
- Auto-Save per onBlur (upsert), Sets bleiben bei App-Neustart erhalten
- Max-Kraft separat bearbeitbar (eigene Tabelle `max_lifts`, Modal mit Bleistift-Button)
- Training abschließen Button (setzt `status = 'completed'`), Bearbeitung bleibt danach möglich
- Auto-Abschluss alter Workouts beim App-Start
- Analyse-Seite: Zeitraum-Toggle (Woche/Monat/3M/6M), Übungs-Auswahl, Stat-Chips (PB/Letztes/Einheiten), Balkendiagramm (PB = gold), Trend-Übersicht
- Profil: „Hallo, Nickname!", Profildaten bearbeitbar (Vorname/Nachname/Spitzname), Sprache DE/EN/RU, Erscheinungsbild
- Mehrsprachigkeit: DE/EN/RU überall via `useLang()` Context — Login, Register, Profil, Home, Training, Analyse, BottomNav
- Hell-Modus als Default, Dark-Mode Toggle

### Offen / Next Steps
1. **Passwort vergessen Flow** — `app/forgot-password/page.tsx` + `app/reset-password/page.tsx` mit Supabase `resetPasswordForEmail()` und `updateUser()`. `proxy.ts` muss `/forgot-password` und `/reset-password` als public Routes eintragen.
2. **Classic Modus Supabase-Anbindung** — `app/(app)/classic/page.tsx` nutzt noch Dummy-Daten und lokalen State. Muss auf echte `exercises`-Tabelle und `sets`-Upsert umgestellt werden, analog zu `/training`.
3. **Analyse: Wochentage korrekt** — die Wochentags-Labels im Kalender auf der Home-Seite sind noch statisch hardcodiert.
4. **Fehlerbehandlung** — bei fehlender Internetverbindung gibt es keine User-Rückmeldung (kein Toast/Offline-Hinweis).

---

## Wichtige Dateien

```
app/
  layout.tsx              — Root-Layout, Providers, Hell-Modus Default, Theme-Script
  providers.tsx           — LangProvider wrapper
  login/page.tsx          — Login mit Sprachauswahl
  register/page.tsx       — Register mit Vorname/Nachname/Nickname/Sprachauswahl
  (app)/
    layout.tsx            — App-Shell mit BottomNav
    page.tsx              — Home/Dashboard
    training/page.tsx     — EGYM Zirkel (Hauptfeature)
    classic/page.tsx      — Klassisches Training (UI fertig, DB fehlt)
    analyse/page.tsx      — Analyse mit Recharts
    profil/page.tsx       — Profil & Einstellungen
components/
  BottomNav.tsx           — Navigationsleiste unten, übersetzt
lib/
  supabase/client.ts      — Browser Supabase Client
  supabase/server.ts      — Server Supabase Client
  i18n.ts                 — Alle Übersetzungen + t() Funktion + LANG_LABELS
  LanguageContext.tsx     — useLang() React Context
supabase/migrations/
  001_training_refactor.sql
  002_profile_fields.sql
proxy.ts                  — Auth-Middleware (public: /login, /register)
```

---

## Session-Log

### Session 1 (Erstes Setup)
- Projekt angelegt, Next.js 16 + Supabase eingerichtet
- Auth (Login/Register), EGYM Training MVP, Deployment auf Vercel

### Session 2 (2026-06-13)
- **Training komplett überarbeitet:** 1 Oberfläche statt Runden-Tabs, horizontales Grid Max Kraft|R1|R2|R3, Auto-Save onBlur, Max-Kraft Modal
- **Neue Tabellen:** `max_lifts`, `workouts.status/completed_at`, Unique Constraint auf `sets`
- **Training abschließen Button** — nach allen Panels, nicht sticky (kein Block mehr)
- **Bearbeitung nach Abschluss** weiterhin möglich
- **Auto-Abschluss** alter Workouts app-seitig beim Init
- **Analyse-Seite** neu implementiert mit Recharts Balkendiagramm, Zeitraum-Toggle, PB-Hervorhebung
- **Profil** erweitert: Hallo Nickname!, Profildaten bearbeitbar, Sprache in Einstellungen
- **Mehrsprachigkeit DE/EN/RU** eingeführt: `lib/i18n.ts`, `lib/LanguageContext.tsx`, alle Seiten migriert
- **Hell-Modus als Default**, kein Flicker durch Inline-Script in layout.tsx
- **Sprachauswahl in Login und Register** hinzugefügt
- Datenbank-Migrationen 001 + 002 erfolgreich in Supabase ausgeführt
