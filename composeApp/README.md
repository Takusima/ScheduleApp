# ScheduleApp KMP migration

The composeApp module is the new cross-platform foundation for ScheduleApp.

Targets:
- Android
- iOS / iPhone

Migration rule:
- Keep the working Android 0.2 UI until its replacement is feature-complete.
- Rebuild screens with Compose Multiplatform.
- Move schedule parsing, group selection, subjects, teachers, curator, favorites and customization into shared Kotlin where platform-independent.
- Keep platform bridges only for file pickers, notifications, widgets and background work.

Migration order:
1. Main schedule
2. Calendar
3. Subjects
4. Settings and customization
5. Group onboarding
6. Excel/Mail sync
7. Notifications and widgets
8. Remove the legacy WebView after parity is verified.
