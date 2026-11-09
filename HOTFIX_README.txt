# Hotfix: RoomHeader avatar runtime error and text caret behavior

Apply at your repository root, replacing the two matching files.

- `RoomHeader.jsx`: adds the missing `localAvatarUrl` component prop default, fixing `ReferenceError: localAvatarUrl is not defined`.
- `globals.css`: reserves the text caret and I-beam cursor for focused editable controls; static text and non-editable interface elements no longer show an insertion cursor.

After copying, restart the Next.js dev server. Backend changes are not required.
