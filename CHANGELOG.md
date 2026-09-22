# Changelog

## GNOME 46

This branch adds GNOME Shell 46 compatibility to Touch Board.

### Added

- GNOME Shell 46 to the supported shell versions.
- GNOME 46-specific compatibility documentation.
- Documentation of the Korean IBus Hangul input issue encountered on GNOME 46.

### Changed

- Updated the `@girs/gnome-shell` development dependency for GNOME 46 compatibility.
- Updated the keyboard container initialization in `src/lib/keyboard.js`:
  - replaced `orientation: Clutter.Orientation.VERTICAL`
  - with `vertical: true`

### Korean Input

Korean Hangul input was verified after updating the IBus Hangul stack:

- `ibus-hangul` 1.5.5-4
- `libhangul1` 0.2.0-1build1
- `libhangul-data` 0.2.0-1build1

The update fixes the separated Hangul jamo behavior observed with virtual on-screen keyboard input.

### Tested

- Ubuntu 24.04 LTS
- GNOME Shell 46.0
- Wayland
- Surface Go
- x86_64
- Touch input
- English input
- Korean Dubeolsik input
