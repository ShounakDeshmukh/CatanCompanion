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
  where the Seafarers rule book p.10 shows a 12, in both its map and its number-disc
  table.

### seafarers-generator.com

The 5-6 player Seafarers layouts in `src/data/boards/expansions56.ts` were read out of the
rendered board at https://www.seafarers-generator.com, since catan-randomizer carries no 5-6
Seafarers boards. Every one is checked against the component table printed in
the Seafarers 5-6 extension rule book.

Two departures from that source:

- **The Fog Islands, 5-6.** Its layout there does not match the rule book, so that board is
  transcribed by hand from the Seafarers 5-6 extension rule book p.6.
- **Cloth for Catan, 5-6.** The generator gives each of the six villages one number disc
  where the rule book gives it two ("The 12 number discs on the six small islands represent
  villages", p.9). The pairs are restored from the map.

### game-icons.net

The resource, building, and commodity SVGs used in the cost reference and map UI are vectors published on [game-icons.net](https://game-icons.net), including work by
[Delapouite](https://delapouite.com), [Lorc](https://lorcblog.blogspot.com), and the broader
contributors to that collection. Their icons are distributed under the
[CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) license.



### Artwork

The terrain, harbor and robber artwork in `src/assets` was made for this project. It is
drawn procedurally as SVG and shipped as WebP images rendered from those SVGs; it does not
trace or reproduce the published CATAN tiles. The parchment texture is generated the same
way.

### Libraries

- [PeerJS](https://peerjs.com) (MIT) connects a game's host to its viewers. It uses the
  PeerJS project's public broker to introduce the two browsers; game data then travels
  directly between them and is not sent to any server of this project's.
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT) draws the
  QR code for a viewer link.
