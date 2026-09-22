# GNOME 46 Korean Input

## Problem

On Ubuntu 24.04 LTS with GNOME Shell 46, Korean input through an on-screen keyboard initially produced separated Hangul jamo.

The same behavior was observed with:

- GNOME's built-in on-screen keyboard
- Touch Board

Physical keyboard Korean input worked normally.

This showed that the problem was not specific to Touch Board.

## Cause

GNOME Shell 46's virtual input method sends virtual key events through IBus with a keycode of `0`.

Touch Board uses GNOME Shell's input method API:

    Main.inputMethod.handleVirtualKey(keyval)

GNOME's own on-screen keyboard follows the same virtual-key input path.

The stock Ubuntu 24.04 `ibus-hangul` package did not correctly handle this on-screen keyboard event path.

## Solution

The IBus Hangul stack was updated to:

- `ibus-hangul` 1.5.5-4
- `libhangul1` 0.2.0
- `libhangul-data` 0.2.0

The newer `ibus-hangul` version contains support for key events from on-screen keyboards, including events without a hardware keycode.

## Verification

After updating the IBus Hangul stack:

- GNOME Shell's built-in on-screen keyboard produced normal Korean composition.
- Touch Board produced normal Korean composition.
- Dubeolsik (2-set) Hangul input worked without jamo separation.
- No Touch Board Korean-input code change was required.

## Important Note

If Korean input is broken on GNOME 46, changing Touch Board's keyboard layout is not necessarily the solution.

Check the IBus Hangul version first.

The Korean input problem observed during GNOME 46 porting was an IBus Hangul compatibility issue, not a Touch Board layout or GNOME 46 Touch Board porting issue.
