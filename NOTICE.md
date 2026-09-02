# Notices

Catan Companion is a fan-made reference. It is not affiliated with, endorsed by, or sponsored
by CATAN GmbH or CATAN Studio. CATAN, Catan, Seafarers and Cities & Knights are trademarks of
CATAN GmbH, used here only to identify the games this tool is a companion to.

catan_comp is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE).

## Third-party material

### catan-randomizer

`src/data/boards/expansions.ts` contains board layouts ported from
[catan-randomizer](https://github.com/thisisrandy/catan-randomizer) by thisisrandy, which is
licensed under the GPL-3.0. The hex representation used throughout this project — the
`HexTemplate[][]` board grid with `{ type: "empty" }` half-column padding, ports carrying an
edge `orientation`, shuffle `group`s, per-position `maxPipsOnChit`, and the `horizontal` flag
for Seafarers-style boards — follows that project's design. This project is GPL-3.0 as a
result.

Two corrections were made against the published rule books during the port:

- **Through the Desert, 3-player.** The ported layout carried a second 11 on the small island
  where Rules/Catan Seafarers 3_4.pdf p.10 shows a 12, in both its map and its number-disc
  table.

### seafarers-generator.com

The 5-6 player Seafarers layouts in `src/data/boards/expansions56.ts` were read out of the
rendered board at https://www.seafarers-generator.com, since catan-randomizer carries no 5-6
Seafarers boards. Every one is checked against the component table printed in
Rules/Catan Seafarers 5_6.pdf.

Two departures from that source:

- **The Fog Islands, 5-6.** Its layout there does not match the rule book, so that board is
  transcribed by hand from Rules/Catan Seafarers 5_6.pdf p.6.
- **Cloth for Catan, 5-6.** The generator gives each of the six villages one number disc
  where the rule book gives it two ("The 12 number discs on the six small islands represent
  villages", p.9). The pairs are restored from the map.

### Rule books

The PDFs under `Rules/` are published by CATAN GmbH / CATAN Studio and are included for
reference only. They are not covered by this project's license. CATAN is a trademark of
CATAN GmbH.
