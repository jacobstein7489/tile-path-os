# UI Surgery Pass 1B

## Scope
- Keep the accepted project shell, Overview, three-pane Rooms workspace, visual system, and all existing backend architecture.
- Change only the project shell, Overview details, Rooms workflow, Design Meeting presentation/flow, and existing question-rule catalogue values.
- No schema changes, procurement work, unrelated screen redesigns, or Sprint 2 work.

## Implementation
1. Compact the mobile project header into identity/stage/actions, one metadata line, and fixed Overview/Rooms/Work/Files/More navigation. Keep Update in mobile overflow and keep the visible tab label “More.”
2. Preserve the Overview composition while hiding empty waiting links and replacing raw requirement counts with meaningful room/surface/design setup summaries. Keep detailed blockers in the drawer.
3. Correct Rooms:
   - summarize readiness by affected surfaces, not blocker rows;
   - make Plan project-level and usable before room selection, with file/page/location plus existing-room or new-room linking;
   - format product summaries deliberately;
   - wire every visible Add action to the correct editor category/control;
   - stage all editor changes locally and persist only through Save Changes;
   - add room-level multi-surface assignment of one existing finish selection to default zones.
4. Correct the existing question catalogue without changing its schema: move product/grout/known-profile metadata to Finish specification and keep genuine layout/treatment choices in Design decisions. Add a defensive target-field filter in Design Meeting.
5. Group the Design Meeting rail by room and surface, keeping every surface visible once with Ready or remaining-decision state. Selecting a surface opens its next unresolved question.
6. Make every simple choice selectable before confirmation. Confirm & Next performs the existing allowlisted write and decision log. Show progress within the current surface.
7. Preserve the exact-one unresolved Work Item behavior and add the existing waiting-on text to that flow. Move naturally to the next question after tracking.
8. Keep mobile decision actions fixed above the global navigation.

## Verification
- Validate types and live interactions without mutating production project data.
- Use the archived QA clone for write-path checks when artificial answers or assignments are needed.
- Confirm no raw blocker counts, duplicate surface rows, instant choice writes, dead Add actions, blur saves, or hidden mobile actions.
- Capture the requested 1440×900 and 390px screenshots, verify no horizontal overflow, and report exact changed files, acceptance results, failures, and data-integrity counts.