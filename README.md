# EGYM Tracker App - Project State & Memory

Dieses Dokument dient als "Gedächtnis" für zukünftige KI-Sessions. **Bitte lies dieses Dokument als Erstes, bevor du neuen Code schreibst.**

## 🎯 Vision
Eine kostenlose, minimalistische PWA (Progressive Web App) für das Tracking von EGYM-Zirkeltraining und klassischen freien Übungen, optimiert für das iPhone 14 Pro.

## 🛠 Tech Stack
- **Frontend:** Next.js 16 (App Router), React, Lucide Icons, Plain CSS (`app/globals.css`).
- **Backend/DB:** Supabase (PostgreSQL, Row Level Security, Auth).
- **Hosting:** Vercel (Deployment via Vercel CLI / GitHub).

## ✅ Was bisher erreicht wurde (Status: Live MVP)
- **Umgebung:** Node v24, Next.js 16 eingerichtet. `middleware.ts` wurde erfolgreich durch Next.js 16 `proxy.ts` ersetzt.
- **Datenbank:** Supabase Tabellen (`profiles`, `exercises`, `workouts`, `sets`) mit RLS (Row Level Security) sind aufgesetzt.
- **Authentifizierung:** Login und Registrierung (`/login`, `/register`) funktionieren live mit Supabase (E-Mail-Bestätigung temporär deaktiviert für schnelles Testen).
- **UI/UX:** Dark- und Light-Mode implementiert (Toggle in `/profil`).
- **EGYM Modus (`/training`):** 
  - 8 Geräte als Akkordeon-Panels.
  - Holt historische Daten aus Supabase ("Max Kraft" & "Letztes Gewicht").
  - Klick auf "Bestätigen" speichert das Gewicht direkt in Supabase (Tabelle `sets`).
  - Springt nach 8 Bestätigungen automatisch in Runde 2.
- **Klassischer Modus (`/classic`):** 
  - Freies Training (z.B. Bankdrücken) ist visuell umgesetzt (Set-Historie im Panel).
- **Deployment:** Vercel ist eingerichtet, App läuft als installierbare PWA auf dem iPhone-Homescreen.

## 🚀 Was als Nächstes ansteht (Next Steps für die nächste KI)
1. **Classic Modus API:** Die `handleAddSet` Funktion in `app/(app)/classic/page.tsx` muss noch an Supabase angebunden werden, analog zum EGYM-Modus (aktuell nur lokaler State).
2. **Analyse Seite (`/analyse`):** Daten aus Supabase (`sets` Tabelle) aggregieren und als Chart/Graph anzeigen (Kraftentwicklung über die Zeit).
3. **PWA Finetuning:** Evtl. Offline-Support via Service Worker prüfen, falls gewünscht.
4. **Fehlerbehandlung:** Bessere Lade-Animationen und Error-Toasts (z.B. mit `sonner` oder `react-hot-toast`), falls das Internet auf der Trainingsfläche mal weg ist.

## 🔑 Architektur-Hinweise
- Wir verwenden Next.js Server Actions **noch nicht** tiefgreifend, da wir stark auf Client-Components (`use client`) für die Echtzeit-Akkordeons angewiesen sind. Die Supabase-Verbindung im Training läuft aktuell über den `@supabase/ssr` Browser-Client.
- RLS Policies sind aktiv! Immer sicherstellen, dass `workout_id` und `auth.uid()` korrekt verknüpft sind, wenn Daten geladen werden.
