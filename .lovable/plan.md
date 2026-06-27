OdoLog v2 Feature Plan
======================

Goals
-----
- Make OdoLog feel like a true companion, not just a logbook.
- Add automation so users never miss a service, expiry, or price drop.
- Add lightweight social features (trips, sharing) without complexity.
- Double down on mobile PWA experience (offline, gestures, haptics).
- Everything stays 100% free.

New Features by Pillar
----------------------

### 1. Deeper Data Insights
- Monthly / Yearly Report Card
  - One-tap summary of total spend, total km, average mileage, cost/km for any month or year.
  - Export as a clean shareable image (like a receipt) + CSV.
- Fuel Efficiency Scorecard
  - Compare actual mileage against ARAI claimed mileage with a simple "You're getting 87% of claimed" score.
- Cost Projection
  - "At your current rate, you'll spend ~₹X,XXX on fuel this year."
- Vehicle Health Score
  - Derived from maintenance gaps, overdue services, tyre condition age, and oil change delays. Shown as a 0-100 ring on the vehicle card.

### 2. Smart Automation
- Push Notification Reminders (via Web Push)
  - Service due (ODO or date approaching)
  - Insurance / PUC / Fitness test expiring in 90, 30, and 7 days
  - Optional: fuel price changed in your city today
- Smart "Next Refuel" Estimate
  - Based on your consumption pattern and last ODO, suggest an approximate km when you'll need fuel again.
- Document Expiry Countdown
  - Visual countdown rings on the vehicle page for Insurance, PUC, and Fitness.
- Auto Fuel Price Suggestion
  - On the refuel form, auto-suggest today's rate for the user's saved city (they can still override).

### 3. Trips & Social
- Trip Logger
  - Log a trip with start/end ODO, purpose, tolls, parking costs.
  - Auto-compute trip mileage and cost.
- Trip Cost Splitter
  - Add co-passengers and split toll/fuel costs evenly or by percentage.
- Garage Sharing (Invite Link)
  - Generate a read-only or collaborative invite link for a vehicle.
  - Viewers see refuel history, maintenance, and cost/km (great for family cars or fleets).
- Achievement Badges
  - Hypermiler (exceed ARAI mileage)
  - Consistent Logger (log 10 refuels in a row without gaps)
  - Maintenance Pro (all services on time for 1 year)
  - Saver (EV owner — displayed with a leaf icon)

### 4. Mobile PWA Polish
- Offline Refuel Queue
  - Save a refuel even with no signal; it queues locally and syncs when connection returns.
- Swipe Actions on History
  - Swipe a refuel or maintenance row left to edit, right to delete.
- Pull-to-Refresh
  - On the dashboard and vehicle pages.
- Haptic Feedback
  - Light vibration on successful save, delete, and badge unlock.
- Bottom Sheet Modals
  - Add refuel, add maintenance, and add trip open as bottom sheets on mobile instead of center dialogs.
- Quick-Add Widget (Home Screen Shortcut)
  - Long-press app icon → "Log Refuel" jumps straight to the form pre-filled for your primary vehicle.

Schema Changes Required
-----------------------
- `trips` table: vehicle_id, start_odo, end_odo, date, purpose, tolls_inr, parking_inr, notes
- `trip_splits` table: trip_id, participant_name, share_percent
- `user_achievements` table: user_id, badge_key, unlocked_at
- `notification_subscriptions` table: user_id, endpoint, p256dh, auth (for web push)

No monetization or paywalls are introduced in v2. Everything above is available to guest and signed-in users alike.

---

Next Step
---------
Once you approve this direction, I can break it into sprints and start building. Pick any specific feature you want to tackle first, or approve the full plan and I'll begin with the highest-impact items (push notifications + offline queue + monthly report card).