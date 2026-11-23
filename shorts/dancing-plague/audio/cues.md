# The Dancing Plague - soundtrack cue sheet

All sound is original: synthesized in numpy/scipy by `sfx_gen.py` / `instruments.py`, placed by `sfx.py` / `music.py`, mixed by `mix.py`.
Voice = `voice/voice.wav`, gain only (no EQ, no compression, no pitch).

## Files
| file | content |
|---|---|
| `mix.wav` | final mix, 48 kHz, stereo, 24-bit, 3,320,000 samples = 69.167 s |
| `stem_voice.wav` / `stem_music.wav` / `stem_sfx.wav` | stems at mix gain (they sum to the mix before the master limiter) |

## Master loudness (own BS.1770-4 meter)
- Integrated **-16.0 LUFS**, true peak **-1.2 dBTP**, LRA 2.8 LU, max momentary -10.8 LUFS, max short-term -13.9 LUFS
- Stems: voice -16.1 LUFS, music -26.6 LUFS, sfx -33.8 LUFS (voice gain +7.43 dB, same gain on every stem)
- Master limiter (4x oversampled look-ahead, ceiling -1.2 dBTP): max gain reduction 4.27 dB, active (>0.1 dB) on 1.59 % of samples, >0.5 dB on 0.51 %

ffmpeg ebur128 cross-check:
```
Summary:
  Integrated loudness:
    I:         -16.0 LUFS
    Threshold: -26.1 LUFS
  Loudness range:
    LRA:         2.8 LU
    Threshold: -36.1 LUFS
    LRA low:   -17.4 LUFS
    LRA high:  -14.5 LUFS
  True peak:
    Peak:       -1.2 dBFS
```

## Voice on top: per-section loudness (LUFS, integrated per stem, at mix gain)
bed = music + sfx. margin = voice - bed (integrated over the section). speech median / p10 = median and 10th percentile of the 400 ms momentary margin (voice - bed) over windows centred on spoken words.

| section (shots) | time s | voice | music | sfx | bed | margin LU | speech median LU | speech p10 LU |
|---|---|---|---|---|---|---|---|---|
| hook | 0.00-5.27 | -15.5 | -24.5 | -38.0 | -24.4 | 8.8 | 8.6 | 6.7 |
| town | 5.27-15.85 | -14.7 | -25.7 | -35.8 | -25.4 | 10.7 | 10.9 | 7.4 |
| creep | 17.30-25.00 | -15.4 | -26.4 | -32.0 | -25.4 | 10.0 | 10.1 | 5.9 |
| spread | 25.00-28.10 | -17.9 | -27.9 | -37.2 | -27.4 | 9.5 | 9.6 | 6.6 |
| doctors | 28.10-34.55 | -16.0 | -26.5 | -42.2 | -26.4 | 10.4 | 13.8 | 7.0 |
| cure | 34.55-43.75 | -17.0 | -26.5 | -35.8 | -26.1 | 9.0 | 8.5 | 6.0 |
| fall | 43.75-44.70 | -18.7 | -28.7 | -25.8 | -23.9 | 5.2 | 5.5 | 4.2 |
| lullaby | 44.70-50.40 | -15.8 | -27.4 | -33.0 | -26.6 | 10.7 | 11.2 | 7.0 |
| dread | 50.40-56.50 | -17.4 | -27.9 | -39.3 | -27.6 | 10.2 | 11.4 | 7.4 |
| city | 56.50-59.90 | -16.9 | -25.9 | -33.4 | -25.2 | 8.3 | 8.9 | 7.3 |
| road | 60.50-67.30 | -16.4 | -27.9 | -35.8 | -27.2 | 10.8 | 10.6 | 7.8 |
| shoes | 67.30-69.17 | -17.7 | -27.7 | -31.6 | -26.5 | 8.9 | 12.0 | 5.2 |

## Music map (original jig, D dorian, 6/8, dotted quarter = 100 bpm)
Music target per section, LU under the voice (after a -3 dB speech duck keyed from words.json): hook -9.0, town -11.0, silence -30.0, creep -11.0, spread -10.0, doctors -10.5, cure -9.5, fall -10.0, lullaby -11.5, dread -10.5, city -9.0, cut -30.0, road -11.5, shoes -10.0. Applied section gains (dB): hook -24.0, town -13.8, silence -25.6, creep -16.1, spread -22.2, doctors -21.7, cure -25.0, fall -21.9, lullaby -15.0, dread -21.6, city -25.6, cut -35.8, road -15.1, shoes -25.3.

Rides (music only, dB):  (none).

| time s | frame | music |
|---|---|---|
| 0.00 | 0 | jig (pipe, lute, tabor, drone) - the plague in full swing |
| 5.27 | 158 | town: slow lute broken chords + soft pad |
| 15.85 | 476 | music stops dead on 'No music' |
| 17.30 | 519 | tension pulse (low lute D-A), ostinato joins with the thirty dancers |
| 25.00 | 750 | hundreds: tabor + drone + rising pipe fragments |
| 28.10 | 843 | doctors: pizzicato walk, timpani 'hot blood', glock 'Luckily', triangle 'cure' |
| 34.60 | 1038 | 'more dancing': the jig returns |
| 43.65 | 1310 | pipe note sags a fifth as the dancers drop |
| 44.80 | 1344 | lullaby for the yawns |
| 50.40 | 1512 | dread drone, timpani on 'Saint Vitus', drum roll into 'whole city' |
| 56.55 | 1696 | whole city: jig full; cut on the second hammer blow ('banned') |
| 60.50 | 1815 | road to the shrine: slow lute + pad |
| 67.75 | 2032 | red shoes: one cheeky bar of the jig on the pipe |

## SFX events
Level convention: every EVENT has a naive level (LU vs the voice stem, as the event's max momentary loudness); applied = naive - 6 dB (standard mix rule) + distance/intensity offsets. BEDS are integrated loudness, not reduced. 'mix LUFS' = the event's max momentary loudness in the final mix (voice stem = -16.1 LUFS integrated). Column sounds also get the camera-distance low-pass and more valley reverb.

| # | time s | frame | cue | what | naive LU | applied LU | mix LUFS | pan |
|---|---|---|---|---|---|---|---|---|
| 1 | 0.000 | 0.0 | amb_town_1 (bed, integrated) | town square air: breeze, sparrows, distant voices (shots 1-20) | -31 | -31.0 | -47.1 | +0.00 |
| 2 | 0.000 | 0.0 | feet_hook (bed, integrated) | hundreds of dancers on cobbles: taps, scuffs, hop landings, groans (hook) | -23 | -23.0 | -39.1 | +0.00 |
| 3 | 2.033 | 61.0 | glide_whoosh | glide down into the crowd | -17 | -23.0 | -39.1 | +0.00 |
| 4 | 4.947 | 148.4 | flash_whoosh | whoosh into the white flash after the hook | -10 | -16.0 | -32.1 | +0.00 |
| 5 | 9.317 | 279.5 | gasp | the customer gasps at the price | -13 | -19.0 | -35.1 | +0.15 |
| 6 | 9.367 | 281.0 | coin | coins tumbling: the price of one loaf | -12 | -18.0 | -34.1 | +0.20 |
| 7 | 9.477 | 284.3 | coin | coins tumbling: the price of one loaf | -12 | -18.0 | -34.1 | +0.20 |
| 8 | 9.617 | 288.5 | coin | coins tumbling: the price of one loaf | -12 | -18.0 | -34.1 | +0.20 |
| 9 | 9.767 | 293.0 | coin | coins tumbling: the price of one loaf | -12 | -18.0 | -34.1 | +0.20 |
| 10 | 9.887 | 296.6 | coin | coins tumbling: the price of one loaf | -12 | -18.0 | -34.1 | +0.20 |
| 11 | 13.550 | 406.5 | door_creak | her front door creaks open | -13 | -19.0 | -35.1 | -0.10 |
| 12 | 14.020 | 420.6 | step | Troffea steps out into the lane | -15 | -21.0 | -37.1 | +0.00 |
| 13 | 14.320 | 429.6 | step | Troffea steps out into the lane | -15 | -21.0 | -37.1 | +0.00 |
| 14 | 14.620 | 438.6 | step | Troffea steps out into the lane | -15 | -21.0 | -37.1 | +0.00 |
| 15 | 15.047 | 451.4 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 16 | 15.482 | 464.5 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 17 | 15.917 | 477.5 | dance_tap | Troffea's shoes on the cobbles, every kick (wide) | -15 | -21.0 | -37.1 | +0.00 |
| 18 | 16.352 | 490.6 | dance_tap | Troffea's shoes on the cobbles, every kick (wide) | -15 | -21.0 | -37.1 | +0.00 |
| 19 | 16.787 | 503.6 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 20 | 17.221 | 516.6 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 21 | 17.656 | 529.7 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 22 | 18.091 | 542.7 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 23 | 18.526 | 555.8 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 24 | 18.960 | 568.8 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 25 | 19.395 | 581.9 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 26 | 19.830 | 594.9 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 27 | 20.265 | 607.9 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 28 | 20.700 | 621.0 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 29 | 20.783 | 623.5 | snore | the husband asleep on the step | -14 | -20.0 | -36.1 | +0.25 |
| 30 | 20.850 | 625.5 | xfade_swish | day-night-day swish | -20 | -26.0 | -42.1 | +0.00 |
| 31 | 21.134 | 634.0 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 32 | 21.250 | 637.5 | xfade_swish | day-night-day swish | -20 | -26.0 | -42.1 | +0.00 |
| 33 | 21.569 | 647.1 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 34 | 22.004 | 660.1 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 35 | 22.350 | 670.5 | feet_thirty (bed, integrated) | thirty dancers join in the lane | -25 | -25.0 | -41.1 | +0.00 |
| 36 | 22.400 | 672.0 | glide_whoosh | pull back up the lane | -17 | -23.0 | -39.1 | +0.00 |
| 37 | 22.439 | 673.2 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 38 | 22.873 | 686.2 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 39 | 23.308 | 699.2 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 40 | 23.743 | 712.3 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 41 | 24.178 | 725.3 | dance_tap | Troffea's shoes on the cobbles, every kick | -10 | -16.0 | -32.1 | +0.00 |
| 42 | 24.267 | 728.0 | feet_august (bed, integrated) | hundreds dancing in the square (crane up, hopping and spinning) | -22 | -22.0 | -38.1 | +0.00 |
| 43 | 24.950 | 748.5 | glide_whoosh | crane up over the square | -17 | -23.0 | -39.1 | +0.00 |
| 44 | 28.100 | 843.0 | feet_doctors (bed, integrated) | the crowd dancing behind the doctors (quieter) | -29 | -29.0 | -45.1 | +0.00 |
| 45 | 29.283 | 878.5 | flask | glass flask held up to the light | -16 | -22.0 | -38.1 | -0.20 |
| 46 | 34.500 | 1035.0 | feet_cure (bed, integrated) | more dancing: the crowd dances harder (stage, band, strong men) | -24 | -24.0 | -40.1 | +0.00 |
| 47 | 35.600 | 1068.0 | hall_doors | guildhall doors swing open | -13 | -19.0 | -35.1 | +0.20 |
| 48 | 36.150 | 1084.5 | hall_bang | the doors bang against the wall on 'clears' | -12 | -18.0 | -34.1 | +0.25 |
| 49 | 37.200 | 1116.0 | carpenter_hit | carpenter nailing the stage boards | -11 | -17.0 | -33.1 | +0.10 |
| 50 | 37.650 | 1129.5 | carpenter_hit | carpenter nailing the stage boards | -11 | -17.0 | -33.1 | +0.10 |
| 51 | 38.100 | 1143.0 | carpenter_hit | carpenter nailing the stage boards | -11 | -17.0 | -33.1 | +0.10 |
| 52 | 38.550 | 1156.5 | carpenter_hit | carpenter nailing the stage boards | -11 | -17.0 | -33.1 | +0.10 |
| 53 | 41.500 | 1245.0 | strong_ugh | the strong men heave the dancer up | -12 | -18.0 | -34.1 | +0.10 |
| 54 | 43.820 | 1314.6 | fall_oof | groan as they drop | -10 | -16.0 | -32.1 | -0.10 |
| 55 | 43.880 | 1316.4 | fall_thud | a dancer hits the cobbles | -6 | -12.0 | -28.1 | -0.10 |
| 56 | 44.000 | 1320.0 | feet_after (bed, integrated) | the rest still shuffling after the falls | -30 | -30.0 | -46.1 | +0.00 |
| 57 | 44.050 | 1321.5 | stars | dizzy stars twinkle | -18 | -24.0 | -40.1 | +0.10 |
| 58 | 44.190 | 1325.7 | fall_oof | groan as they drop | -10 | -16.0 | -32.1 | +0.25 |
| 59 | 44.250 | 1327.5 | fall_thud | a dancer hits the cobbles | -6 | -12.0 | -28.1 | +0.25 |
| 60 | 44.540 | 1336.2 | fall_oof | groan as they drop | -10 | -16.0 | -32.1 | -0.30 |
| 61 | 44.600 | 1338.0 | amb_golden_1 (bed, integrated) | golden evening: soft breeze, crickets, blackbird (yawns, shots 21-22) | -31 | -31.0 | -47.1 | +0.00 |
| 62 | 44.600 | 1338.0 | fall_thud | a dancer hits the cobbles | -6 | -12.0 | -28.1 | -0.30 |
| 63 | 46.567 | 1397.0 | yawn_row | the yawn travels along the bench | -12 | -18.0 | -34.1 | +0.00 |
| 64 | 47.167 | 1415.0 | yawn_row | the yawn travels along the bench | -15 | -21.0 | -37.1 | -0.25 |
| 65 | 47.317 | 1419.5 | yawn_row | the yawn travels along the bench | -15 | -21.0 | -37.1 | +0.25 |
| 66 | 47.767 | 1433.0 | yawn_row | the yawn travels along the bench | -15 | -21.0 | -37.1 | -0.50 |
| 67 | 47.917 | 1437.5 | yawn_row | the yawn travels along the bench | -15 | -21.0 | -37.1 | +0.50 |
| 68 | 48.133 | 1444.0 | yawn_a | she yawns | -9 | -15.0 | -31.1 | -0.15 |
| 69 | 49.300 | 1479.0 | yawn_b | ...and he has to yawn too | -9 | -15.0 | -31.1 | +0.15 |
| 70 | 50.300 | 1509.0 | amb_town_2 (bed, integrated) | town square air again (fear, St Vitus, the city, the ban) | -31 | -31.0 | -47.1 | +0.00 |
| 71 | 50.500 | 1515.0 | thunder | distant thunder under the dark cloud ('Fear') | -16 | -22.0 | -38.1 | +0.00 |
| 72 | 51.317 | 1539.5 | stomach | an empty stomach growls ('hunger') | -11 | -17.0 | -33.1 | +0.20 |
| 73 | 56.000 | 1680.0 | feet_city (bed, integrated) | a whole city dancing (crane out) until the ban | -23 | -23.0 | -39.1 | +0.00 |
| 74 | 56.267 | 1688.0 | glide_whoosh | crane out over the whole city | -17 | -23.0 | -39.1 | +0.00 |
| 75 | 59.400 | 1782.0 | ban_hammer | the councillor nails up the no-music notice | -5 | -11.0 | -27.1 | +0.10 |
| 76 | 59.900 | 1797.0 | ban_hammer | the councillor nails up the no-music notice | -5 | -11.0 | -27.1 | +0.10 |
| 77 | 60.450 | 1813.5 | amb_golden_2 (bed, integrated) | golden hills: breeze, crickets, blackbird (road, shrine, shoes) | -31 | -31.0 | -47.1 | +0.00 |
| 78 | 60.450 | 1813.5 | ban_hammer | the councillor nails up the no-music notice | -5 | -11.0 | -27.1 | +0.10 |
| 79 | 60.500 | 1815.0 | cart_road (bed, integrated) | the cart: wooden wheels on the dirt road, creaks, load rattle | -22 | -22.0 | -38.1 | +0.00 |
| 80 | 60.500 | 1815.0 | horse (bed, integrated) | the horse at a walk: hoof falls + harness jingle | -21 | -21.0 | -37.1 | +0.00 |
| 81 | 62.900 | 1887.0 | bell | the shrine's bell | -12 | -18.0 | -34.1 | +0.10 |
| 82 | 64.300 | 1929.0 | bell | the shrine's bell (second stroke) | -15 | -21.0 | -37.1 | +0.10 |
| 83 | 67.183 | 2015.5 | shoes_shimmer | the red shoes appear | -14 | -20.0 | -36.1 | +0.00 |
| 84 | 68.312 | 2049.4 | shoe_tap | a single tap of the red shoes | -8 | -14.0 | -30.1 | +0.00 |
| 85 | 68.605 | 2058.2 | shoe_tap | a single tap of the red shoes | -8 | -14.0 | -30.1 | +0.00 |
