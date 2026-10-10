Notes for potential future milestones:

Text on path tool:

- Currently not functioning correctly, could be refactored/redesigned and fixed
- Could be more focused on the path, rather than opening a dialog it could open the UX via the styles sidebar when a line is select (similar to the image clip when a shape is selected)
- separate tool button to draw line with sample text already on it

Textbox tool:

- insert textbox immediately with specific style panel tools open by default
- Replace dialog with style panel UI
- fix all text box editing in sidebar

AutoSave:

- make more robust to ensure that all changes trigger autosave (potentially resolved with the history fixes)

Fix black icons

some icons are rendering in the canvas editor as black without color

Assets

- currently assets can be shared by any user and are immediately accessible by anyone in the community
  - Could be refactored to require admin approval like the icons

line gradient:

- Currently applies the gradient the same as the "gradient" section, just across the area of the line
- fix so that it applied the gradient along the line

Font color:

- Currently there is a color section that is shared for font and other elements, and a "font color" section that is only for fonts
- Consolidate this into one section with all the color controls

Image:

- remove background isn't working
-

Connector line property panel section

- most of the UX for updating connector lines currently doesn't work

Layers tab

- locking layers doesn't work

Add figure panel labels:

- currently accessible by top menu bar: insert > figure panel labels
- Opens a dialog
- Currently throws an error on insert: "Uncaught ReferenceError: require is not defined"
- can fix and improve UX, potentially add to toolbar and properties panel

Insert scale bar

- currently accessible by top menu bar: insert > scale bar
- opens a dialog
- inserts successfully but no edit ability
- Can improve UX and add to toolbar/properties panel

Color opacity

- change to opacity applied to background and stroke separately, remove rgba colors

Align top, align bottom, align center

- Currently don't work
- Clarify intended purpose and fix

Consolidate arrows and connector lines

- Currently multiple different versions
- Can consolidate into one tool with multiple properties

Curve line fix:

- Editting the curve of a curve line with markers (end points on the line), then saving and reloading the page causes the line to become detached from the end points

Notifications:

- Currently the notification bell shows with a popover to show the first snippet from the notification but the user can't click to read the full notification
- Could implement a notification centre with notification history etc
