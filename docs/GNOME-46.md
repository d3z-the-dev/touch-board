# GNOME 46 Support

This branch adds GNOME 46 compatibility to Touch Board.

## Tested Environment

- Ubuntu 24.04 LTS
- GNOME Shell 46.0
- Wayland
- Surface Go
- x86_64

## Compatibility Changes

### GNOME Shell metadata

GNOME Shell 46 was added to the supported shell versions in `src/metadata.json`.

### GNOME Shell BoxLayout

GNOME 46 does not accept the `orientation` property used by the original implementation of the Touch Board keyboard container.

The keyboard container was changed from:

    orientation: Clutter.Orientation.VERTICAL,

to:

    vertical: true,

in `src/lib/keyboard.js`.

### JavaScript / Input Method

GNOME 46 provides the `Main.inputMethod` API used by Touch Board for virtual key handling.

Touch Board can therefore continue to use:

    Main.inputMethod.handleVirtualKey(keyval)

for IBus-based input.

## Korean Input

Korean input was tested with IBus Hangul.

On Ubuntu 24.04, the stock `ibus-hangul` package caused Korean jamo to be committed separately when virtual key events were sent with `keycode = 0`.

Updating the IBus Hangul stack resolved the issue:

- `ibus-hangul` 1.5.5-4
- `libhangul` 0.2.0

After the update, both GNOME's on-screen keyboard and Touch Board produced normal Dubeolsik Korean composition.

This is an IBus Hangul compatibility issue rather than a Touch Board keyboard-layout issue.

## Status

Touch Board has been tested successfully on GNOME Shell 46 with:

- touch input
- English input
- Korean Hangul input
- modifier keys
- Touch Board preferences
- panel keyboard button
