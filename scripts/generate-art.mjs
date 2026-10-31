/**
 * Generates original, locally-hosted SVG artwork for AURA.
 * Run with: node scripts/generate-art.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("public/art");
for (const dir of ["albums", "artists", "playlists", "genres"]) {
  fs.mkdirSync(path.join(root, dir), { recursive: true });
}

const defs = (id, stops, extra = "") => `
<defs>
  <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join("")}</linearGradient>
  <filter id="grain-${id}" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".82" numOctaves="3" stitchTiles="stitch" result="noise"/>
    <feColorMatrix in="noise" type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="linear" slope=".14"/></feComponentTransfer>
    <feBlend in="SourceGraphic" mode="soft-light"/>
  </filter>
  <filter id="blur-${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="42"/></filter>
  <filter id="blur-wide-${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="90"/></filter>
  ${extra}
</defs>`;

const grain = (id, opacity = 1) =>
  `<rect width="1000" height="1000" filter="url(#grain-${id})" opacity="${opacity}"/>`;

const vignette = `<rect width="1000" height="1000" fill="url(#vig)" opacity=".6"/>`;
const vigDefs = `<radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset="50%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".5"/></radialGradient>`;

const svg = (id, body, stops = [["0", "#111"], ["1", "#222"]], extra = "") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
${defs(id, stops, vigDefs + extra)}
<rect width="1000" height="1000" fill="url(#bg-${id})"/>
${body}
${grain(id)}
${vignette}
</svg>`;

const albums = {
  "halcyon-hours": () => {
    const id = "halcyon";
    return svg(
      id,
      `
      <rect x="120" y="90" width="760" height="820" rx="380" fill="#DCA5A0" opacity=".12"/>
      <circle cx="500" cy="430" r="230" fill="#E9B6A0" opacity=".88" filter="url(#blur-${id})"/>
      <circle cx="500" cy="430" r="132" fill="#F4D5C6" opacity=".85"/>
      <path d="M0 680 Q 260 615 500 675 T 1000 655 V1000 H0Z" fill="#1B1217" opacity=".9"/>
      <path d="M0 735 Q 260 680 500 730 T 1000 710 V1000 H0Z" fill="#130D11"/>
      <g stroke="#E6B7AB" stroke-opacity=".22" stroke-width="1">
        <path d="M120 160 H880"/><path d="M120 240 H880"/><path d="M120 320 H880"/>
      </g>
      <text x="108" y="930" font-family="Arial, sans-serif" font-size="26" letter-spacing="8" fill="#F7E9E2" opacity=".68">MIRA VALE</text>
      <text x="892" y="930" text-anchor="end" font-family="Arial, sans-serif" font-size="22" letter-spacing="3" fill="#F7E9E2" opacity=".42">HALCYON HOURS</text>
      `,
      [["0", "#1D1119"], [".55", "#4A2630"], ["1", "#120C10"]],
    );
  },
  "soft-static": () => {
    const id = "softstatic";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#C8CAC7"/>
      <rect x="70" y="80" width="860" height="640" fill="#E6E4DC" opacity=".74"/>
      <g fill="none" stroke="#383B39" stroke-opacity=".46" stroke-width="1.4">
        ${Array.from({ length: 34 }, (_, i) => {
          const y = 265 + i * 14;
          return `<path d="M0 ${y} Q 180 ${y - 28 - (i % 4) * 9} 380 ${y + 14} T 760 ${y - 12} T 1000 ${y + 8}"/>`;
        }).join("")}
      </g>
      <rect x="548" y="82" width="380" height="638" fill="#1A1B1A" opacity=".92"/>
      <circle cx="740" cy="340" r="94" fill="#10110F" opacity=".85"/>
      <circle cx="740" cy="340" r="54" fill="#C8CAC7" opacity=".13"/>
      <text x="78" y="876" font-family="Arial, sans-serif" font-size="25" letter-spacing="9" fill="#242625" opacity=".72">ELIO NORTH</text>
      <text x="78" y="914" font-family="Arial, sans-serif" font-size="18" letter-spacing="4" fill="#242625" opacity=".44">SOFT STATIC</text>
      `,
      [["0", "#D8D7D0"], ["1", "#AFAFA9"]],
      `<filter id="paper-${id}"><feTurbulence baseFrequency=".03" numOctaves="2"/><feDisplacementMap in="SourceGraphic" scale="7"/></filter>`,
    );
  },
  "blue-hour-cinema": () => {
    const id = "bluehour";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#0A1028"/>
      <circle cx="730" cy="250" r="170" fill="#B4C9FF" opacity=".18" filter="url(#blur-wide-${id})"/>
      <circle cx="730" cy="250" r="82" fill="#DCE6FF" opacity=".68"/>
      <g fill="#070B1A">
        <rect x="0" y="490" width="130" height="510"/><rect x="140" y="420" width="95" height="580"/>
        <rect x="245" y="550" width="155" height="450"/><rect x="410" y="350" width="100" height="650"/>
        <rect x="520" y="480" width="150" height="520"/><rect x="680" y="390" width="120" height="610"/>
        <rect x="810" y="520" width="190" height="480"/>
      </g>
      <g fill="#E9B97F">
        <rect x="170" y="470" width="8" height="8"/><rect x="193" y="525" width="8" height="8"/>
        <rect x="450" y="405" width="7" height="7"/><rect x="565" y="530" width="9" height="9"/>
        <rect x="715" y="455" width="8" height="8"/><rect x="862" y="580" width="7" height="7"/>
        <rect x="448" y="468" width="7" height="7"/><rect x="188" y="610" width="7" height="7"/>
      </g>
      <path d="M0 790 H1000 V810 H0Z" fill="#5176D6" opacity=".3"/>
      <path d="M0 790 H1000 V796 H0Z" fill="#BBD0FF" opacity=".45"/>
      <text x="74" y="930" font-family="Arial, sans-serif" font-size="25" letter-spacing="12" fill="#E4EBFF" opacity=".7">KAIROS</text>
      <text x="926" y="930" text-anchor="end" font-family="Arial, sans-serif" font-size="18" letter-spacing="4" fill="#E4EBFF" opacity=".38">BLUE HOUR CINEMA</text>
      `,
      [["0", "#0C1330"], [".6", "#121D43"], ["1", "#05070F"]],
    );
  },
  vela: () => {
    const id = "vela";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#071012"/>
      <g filter="url(#blur-${id})" opacity=".95">
        <path d="M-100 250 C 180 40 360 500 640 290 S 1000 50 1120 250" fill="none" stroke="#2F7570" stroke-width="170" stroke-linecap="round" opacity=".7"/>
        <path d="M-100 420 C 220 200 370 650 680 410 S 1010 190 1120 380" fill="none" stroke="#8EB7B0" stroke-width="92" stroke-linecap="round" opacity=".47"/>
        <path d="M-100 580 C 180 440 380 820 760 560 S 1020 380 1120 530" fill="none" stroke="#5B4E92" stroke-width="130" stroke-linecap="round" opacity=".64"/>
        <path d="M-100 700 C 200 560 420 900 760 680 S 1040 570 1120 650" fill="none" stroke="#D2B18A" stroke-width="46" stroke-linecap="round" opacity=".34"/>
      </g>
      <g fill="#E5EDE9" opacity=".5">
        <circle cx="270" cy="280" r="2"/><circle cx="710" cy="180" r="1.6"/><circle cx="830" cy="390" r="2.2"/><circle cx="430" cy="690" r="1.4"/>
      </g>
      <rect x="74" y="858" width="852" height="1" fill="#DCE7E2" opacity=".2"/>
      <text x="74" y="922" font-family="Arial, sans-serif" font-size="24" letter-spacing="10" fill="#E4EEEA" opacity=".72">SABLE COAST</text>
      <text x="926" y="922" text-anchor="end" font-family="Arial, sans-serif" font-size="19" letter-spacing="6" fill="#E4EEEA" opacity=".38">VELA</text>
      `,
      [["0", "#091416"], ["1", "#050809"]],
    );
  },
  "paper-planets": () => {
    const id = "paperplanets";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#D9C6A3"/>
      <circle cx="500" cy="470" r="274" fill="#E8D8B8" opacity=".74"/>
      <circle cx="500" cy="470" r="193" fill="none" stroke="#5C4937" stroke-width="1.2" opacity=".55"/>
      <ellipse cx="500" cy="470" rx="435" ry="140" fill="none" stroke="#6B5640" stroke-width="1.3" opacity=".38" transform="rotate(-19 500 470)"/>
      <circle cx="480" cy="430" r="110" fill="#BA8162" opacity=".88"/>
      <circle cx="694" cy="640" r="68" fill="#6C7B6B" opacity=".79"/>
      <circle cx="290" cy="256" r="44" fill="#202522" opacity=".75"/>
      <circle cx="795" cy="270" r="24" fill="#9C6A4F" opacity=".8"/>
      <g fill="#4B3A2B" opacity=".4">
        <circle cx="480" cy="430" r="17"/><circle cx="694" cy="640" r="9"/><circle cx="290" cy="256" r="5"/>
      </g>
      <path d="M70 854 H930" stroke="#4E3C2C" opacity=".4"/>
      <text x="72" y="914" font-family="Arial, sans-serif" font-size="24" letter-spacing="9" fill="#3F3024" opacity=".75">THE PAPER MOONS</text>
      <text x="928" y="914" text-anchor="end" font-family="Arial, sans-serif" font-size="17" letter-spacing="4" fill="#3F3024" opacity=".45">PAPER PLANETS</text>
      `,
      [["0", "#E4D2B0"], ["1", "#C3AC84"]],
    );
  },
  "bloom-in-reverse": () => {
    const id = "bloom";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#09070D"/>
      <g transform="translate(500 490)">
        ${Array.from({ length: 22 }, (_, i) => {
          const angle = (i / 22) * 360;
          const hue = i % 3 === 0 ? "#D65E52" : i % 3 === 1 ? "#8C3A4B" : "#E9927B";
          return `<ellipse cx="0" cy="-240" rx="${42 + (i % 5) * 15}" ry="${240 + (i % 4) * 45}" fill="${hue}" opacity="${0.12 + (i % 4) * 0.035}" transform="rotate(${angle})" filter="url(#blur-${id})"/>`;
        }).join("")}
        <circle cx="0" cy="0" r="116" fill="#F1C8AE" opacity=".9"/>
        <circle cx="0" cy="0" r="72" fill="#2A1117" opacity=".88"/>
        <circle cx="0" cy="0" r="26" fill="#F5DAC5" opacity=".85"/>
      </g>
      <g stroke="#EFAF98" stroke-opacity=".15">
        <path d="M100 120 H900"/><path d="M100 880 H900"/>
      </g>
      <text x="100" y="945" font-family="Arial, sans-serif" font-size="22" letter-spacing="9" fill="#F3D6C8" opacity=".6">IRIS EMBER</text>
      <text x="900" y="945" text-anchor="end" font-family="Arial, sans-serif" font-size="17" letter-spacing="3" fill="#F3D6C8" opacity=".34">BLOOM IN REVERSE</text>
      `,
      [["0", "#08060A"], [".55", "#2C1018"], ["1", "#08060A"]],
    );
  },
  "low-tide": () => {
    const id = "lowtide";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#142022"/>
      <rect y="160" width="1000" height="620" fill="url(#bg-${id})" opacity=".9"/>
      <path d="M0 560 Q 210 540 400 558 T 760 548 T 1000 556 V1000 H0Z" fill="#0C1415"/>
      <path d="M0 664 Q 260 650 500 664 T 1000 660" fill="none" stroke="#D7D8C9" opacity=".27" stroke-width="1.3"/>
      <circle cx="680" cy="384" r="126" fill="#E4E2CF" opacity=".85" filter="url(#blur-${id})"/>
      <circle cx="680" cy="384" r="72" fill="#EFECDA" opacity=".9"/>
      <path d="M600 690 H820" stroke="#E4E2CF" opacity=".24" stroke-width="2"/>
      <g fill="#D7D8C9" opacity=".28">
        <circle cx="168" cy="220" r="1.6"/><circle cx="396" cy="285" r="1.3"/><circle cx="812" cy="174" r="1.8"/>
      </g>
      <text x="74" y="918" font-family="Arial, sans-serif" font-size="25" letter-spacing="12" fill="#E8E8D9" opacity=".68">NOA ITŌ</text>
      <text x="928" y="918" text-anchor="end" font-family="Arial, sans-serif" font-size="17" letter-spacing="4" fill="#E8E8D9" opacity=".36">LOW TIDE</text>
      `,
      [["0", "#283A3C"], ["1", "#0B1213"]],
    );
  },
  monument: () => {
    const id = "monument";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#9A9A93"/>
      <path d="M0 830 L1000 620 V1000 H0Z" fill="#30312F"/>
      <rect x="128" y="115" width="320" height="715" fill="#D5D3C8"/>
      <rect x="128" y="115" width="320" height="64" fill="#BBB9AE"/>
      <rect x="500" y="340" width="184" height="490" fill="#7D7E77"/>
      <rect x="716" y="190" width="166" height="640" fill="#C0BEB3"/>
      <rect x="716" y="190" width="166" height="35" fill="#E0DDD2"/>
      <path d="M448 115 L448 624 L500 646 V115Z" fill="#222421"/>
      <rect x="190" y="250" width="76" height="110" fill="#353632"/>
      <rect x="302" y="250" width="76" height="110" fill="#353632"/>
      <rect x="778" y="300" width="44" height="380" fill="#3E3F3B" opacity=".7"/>
      <circle cx="828" cy="160" r="29" fill="#A64735"/>
      <text x="74" y="942" font-family="Arial, sans-serif" font-size="25" letter-spacing="11" fill="#EEEDE4" opacity=".8">ASTER HOUSE</text>
      <text x="928" y="942" text-anchor="end" font-family="Arial, sans-serif" font-size="18" letter-spacing="5" fill="#EEEDE4" opacity=".5">MONUMENT</text>
      `,
      [["0", "#A8A79F"], ["1", "#72736D"]],
    );
  },
  afterglow: () => {
    const id = "afterglow";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#2A1712"/>
      <circle cx="500" cy="540" r="410" fill="#D9874F" opacity=".52" filter="url(#blur-wide-${id})"/>
      <circle cx="500" cy="540" r="205" fill="#ECC38A" opacity=".76" filter="url(#blur-${id})"/>
      <circle cx="500" cy="540" r="120" fill="#F7DCAD" opacity=".65"/>
      <path d="M0 640 Q 250 600 500 635 T 1000 620 V1000 H0Z" fill="#11100F"/>
      <path d="M0 700 Q 260 680 500 720 T 1000 690 V1000 H0Z" fill="#090909"/>
      <g stroke="#F1C58E" stroke-opacity=".12">
        <path d="M80 228 H920"/><path d="M80 276 H920"/>
      </g>
      <text x="74" y="930" font-family="Arial, sans-serif" font-size="23" letter-spacing="10" fill="#F8E3C5" opacity=".65">LUMEN &amp; KITE</text>
      <text x="928" y="930" text-anchor="end" font-family="Arial, sans-serif" font-size="17" letter-spacing="4" fill="#F8E3C5" opacity=".36">AFTERGLOW</text>
      `,
      [["0", "#1B100E"], [".55", "#66351F"], ["1", "#0A0908"]],
    );
  },
  "velvet-arithmetic": () => {
    const id = "velvet";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#250B14"/>
      <g filter="url(#blur-${id})" opacity=".7">
        <ellipse cx="380" cy="410" rx="310" ry="380" fill="#6E1F35"/>
        <ellipse cx="710" cy="590" rx="210" ry="310" fill="#2E1420"/>
      </g>
      <g fill="none" stroke="#C89B65" stroke-width="1">
        <circle cx="500" cy="500" r="350" opacity=".35"/>
        <circle cx="500" cy="500" r="275" opacity=".23"/>
        <circle cx="500" cy="500" r="198" opacity=".5"/>
        <path d="M106 500 H894" opacity=".35"/>
        <path d="M500 106 V894" opacity=".35"/>
      </g>
      <rect x="426" y="426" width="148" height="148" fill="#D4A56F" opacity=".84" transform="rotate(45 500 500)"/>
      <circle cx="500" cy="500" r="38" fill="#2B0D17"/>
      <text x="74" y="930" font-family="Arial, sans-serif" font-size="24" letter-spacing="10" fill="#F0D9C4" opacity=".65">JULIEN ARLO</text>
      <text x="928" y="930" text-anchor="end" font-family="Arial, sans-serif" font-size="16" letter-spacing="3" fill="#F0D9C4" opacity=".35">VELVET ARITHMETIC</text>
      `,
      [["0", "#280D16"], [".5", "#4C1726"], ["1", "#16070C"]],
    );
  },
  "north-south": () => {
    const id = "northsouth";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#17232D"/>
      <path d="M0 0 H1000 V1000 L0 0Z" fill="#DAE1DD" opacity=".94"/>
      <path d="M0 0 L1000 1000 H0Z" fill="#162732"/>
      <path d="M0 0 L1000 1000" stroke="#9EABB1" stroke-width="3" opacity=".8"/>
      <circle cx="500" cy="500" r="23" fill="#B54D39"/>
      <g fill="#F0F3F0" opacity=".6">
        <circle cx="276" cy="270" r="2"/><circle cx="756" cy="735" r="2"/>
      </g>
      <text x="74" y="928" font-family="Arial, sans-serif" font-size="24" letter-spacing="12" fill="#E8EEEC" opacity=".75">NORTHBOUND</text>
      <text x="928" y="928" text-anchor="end" font-family="Arial, sans-serif" font-size="18" letter-spacing="5" fill="#E8EEEC" opacity=".38">NORTH / SOUTH</text>
      `,
      [["0", "#E1E5E1"], ["1", "#14232D"]],
    );
  },
  "still-life-moving": () => {
    const id = "stilllife";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#18150F"/>
      <path d="M0 760 H1000 V1000 H0Z" fill="#0E0D0A"/>
      <ellipse cx="500" cy="810" rx="430" ry="54" fill="#000" opacity=".45"/>
      <path d="M322 750 C 295 625 302 530 360 440 H600 C 665 540 668 648 632 750Z" fill="#B2784C" opacity=".8"/>
      <path d="M371 510 C 390 430 380 380 420 320" fill="none" stroke="#48523D" stroke-width="7"/>
      <ellipse cx="434" cy="306" rx="42" ry="21" fill="#5F6B4E" transform="rotate(-25 434 306)"/>
      <circle cx="728" cy="668" r="100" fill="#B08B43" opacity=".84"/>
      <circle cx="662" cy="720" r="68" fill="#80522D" opacity=".8"/>
      <rect x="170" y="125" width="660" height="600" fill="none" stroke="#DAC6A1" opacity=".13"/>
      <path d="M120 180 L500 110 L880 180 V760" fill="none" stroke="#DAC6A1" opacity=".08"/>
      <text x="74" y="930" font-family="Arial, sans-serif" font-size="24" letter-spacing="9" fill="#EFE2CC" opacity=".7">VERA SOL</text>
      <text x="928" y="930" text-anchor="end" font-family="Arial, sans-serif" font-size="16" letter-spacing="3" fill="#EFE2CC" opacity=".37">STILL LIFE, MOVING</text>
      `,
      [["0", "#211C13"], [".6", "#30261A"], ["1", "#0E0D0A"]],
    );
  },
  "drift-studies": () => {
    const id = "drift";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#B7BCC0"/>
      <rect x="0" y="0" width="1000" height="1000" fill="#D6D8D7" opacity=".45"/>
      <g fill="none" stroke="#3E474C" stroke-width="1.1" opacity=".35">
        ${Array.from({ length: 30 }, (_, i) => {
          const offset = i * 28;
          return `<path d="M-50 ${160 + offset} C 220 ${80 + offset} 340 ${370 + offset} 610 ${230 + offset} S 970 ${90 + offset} 1080 ${220 + offset}"/>`;
        }).join("")}
      </g>
      <circle cx="740" cy="250" r="112" fill="#5A6B70" opacity=".16" filter="url(#blur-${id})"/>
      <rect x="70" y="858" width="860" height="1" fill="#30393D" opacity=".3"/>
      <text x="74" y="920" font-family="Arial, sans-serif" font-size="24" letter-spacing="10" fill="#30393D" opacity=".72">ELIO NORTH</text>
      <text x="928" y="920" text-anchor="end" font-family="Arial, sans-serif" font-size="17" letter-spacing="5" fill="#30393D" opacity=".42">DRIFT STUDIES</text>
      `,
      [["0", "#D0D2D1"], ["1", "#9EA4A6"]],
    );
  },
  "golden-thread": () => {
    const id = "golden";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#0B111B"/>
      <circle cx="680" cy="280" r="240" fill="#3A435B" opacity=".2" filter="url(#blur-wide-${id})"/>
      <path d="M-30 760 C 220 560 280 290 560 380 S 780 720 1040 260" fill="none" stroke="#D5B374" stroke-width="2" opacity=".88"/>
      <path d="M-30 760 C 220 560 280 290 560 380 S 780 720 1040 260" fill="none" stroke="#EAD6AA" stroke-width="10" opacity=".12" filter="url(#blur-${id})"/>
      <circle cx="560" cy="380" r="8" fill="#F0DEB5"/>
      <circle cx="560" cy="380" r="42" fill="#E6C88A" opacity=".14" filter="url(#blur-${id})"/>
      <g fill="#EAD6AA" opacity=".4">
        <circle cx="160" cy="230" r="1.4"/><circle cx="812" cy="640" r="1.2"/><circle cx="340" cy="750" r="1.8"/>
      </g>
      <text x="74" y="922" font-family="Arial, sans-serif" font-size="24" letter-spacing="9" fill="#F2E9D8" opacity=".65">MIRA VALE</text>
      <text x="928" y="922" text-anchor="end" font-family="Arial, sans-serif" font-size="16" letter-spacing="4" fill="#F2E9D8" opacity=".35">GOLDEN THREAD</text>
      `,
      [["0", "#0D1522"], [".55", "#121B2C"], ["1", "#070B12"]],
    );
  },
  "nocturne-four": () => {
    const id = "nocturne";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#080C12"/>
      <rect x="184" y="88" width="456" height="610" fill="#465A70" opacity=".22"/>
      <rect x="220" y="124" width="384" height="538" fill="none" stroke="#A9BDD0" opacity=".3"/>
      <path d="M220 124 H604 V662 H220Z" fill="url(#bg-${id})" opacity=".35"/>
      <path d="M220 124 L0 1000 H1000 L604 662Z" fill="#C8D5DE" opacity=".055"/>
      <g fill="#E8EEF1">
        <rect x="680" y="356" width="216" height="12" rx="6" opacity=".8"/>
        <rect x="680" y="376" width="158" height="12" rx="6" opacity=".4"/>
        <rect x="680" y="396" width="192" height="12" rx="6" opacity=".55"/>
      </g>
      <circle cx="500" cy="540" r="8" fill="#D7E3EA" opacity=".7"/>
      <text x="74" y="930" font-family="Arial, sans-serif" font-size="24" letter-spacing="10" fill="#DDE8EF" opacity=".6">NOA ITŌ</text>
      <text x="928" y="930" text-anchor="end" font-family="Arial, sans-serif" font-size="17" letter-spacing="4" fill="#DDE8EF" opacity=".32">NOCTURNE NO. 4</text>
      `,
      [["0", "#101722"], ["1", "#06090E"]],
    );
  },
};

// ---------------- PLAYER-SIZED COVERS ----------------
const playlistArt = {
  "violet-hours": () => {
    const id = "violethours";
    return svg(
      id,
      `
      <rect x="0" y="0" width="1000" height="1000" fill="#0C0A12"/>
      <rect x="352" y="0" width="296" height="1000" fill="#7A47DE" opacity=".16" filter="url(#blur-wide-${id})"/>
      <rect x="466" y="80" width="68" height="840" fill="#B69BF4" opacity=".2" filter="url(#blur-${id})"/>
      <circle cx="500" cy="500" r="245" fill="none" stroke="#AD8DF0" stroke-width="1" opacity=".35"/>
      <circle cx="500" cy="500" r="165" fill="none" stroke="#AD8DF0" stroke-width="1" opacity=".25"/>
      <g fill="#E8DBFF">
        <rect x="452" y="430" width="4" height="110" rx="2" opacity=".85"/>
        <rect x="470" y="450" width="4" height="70" rx="2" opacity=".65"/>
        <rect x="488" y="405" width="4" height="170" rx="2" opacity=".95"/>
        <rect x="506" y="466" width="4" height="60" rx="2" opacity=".5"/>
        <rect x="524" y="424" width="4" height="122" rx="2" opacity=".8"/>
        <rect x="542" y="456" width="4" height="72" rx="2" opacity=".58"/>
      </g>
      <text x="86" y="920" font-family="Arial, sans-serif" font-size="22" letter-spacing="9" fill="#E9DFFF" opacity=".7">AURA EDITORIAL</text>
      <text x="914" y="920" text-anchor="end" font-family="Arial, sans-serif" font-size="16" letter-spacing="4" fill="#E9DFFF" opacity=".38">VIOLET HOURS</text>
      `,
      [["0", "#0B0911"], [".55", "#1B122D"], ["1", "#09080D"]],
    );
  },
  "quiet-luxury": () => {
    const id = "quietluxury";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#D7CDBA"/>
      <rect x="70" y="70" width="860" height="860" fill="#EDE5D6" opacity=".72"/>
      <circle cx="620" cy="380" r="245" fill="#B79A6B" opacity=".54"/>
      <circle cx="620" cy="380" r="245" fill="none" stroke="#6B583D" opacity=".3"/>
      <rect x="130" y="545" width="740" height="1" fill="#665540" opacity=".28"/>
      <rect x="130" y="605" width="740" height="1" fill="#665540" opacity=".18"/>
      <path d="M130 640 H430" stroke="#665540" opacity=".38" stroke-width="1"/>
      <text x="130" y="330" font-family="Georgia, serif" font-size="54" fill="#403628" opacity=".74">Quiet</text>
      <text x="130" y="394" font-family="Georgia, serif" font-size="54" font-style="italic" fill="#403628" opacity=".6">Luxury</text>
      <text x="132" y="866" font-family="Arial, sans-serif" font-size="18" letter-spacing="7" fill="#4B3F2F" opacity=".55">AURA EDITORIAL</text>
      `,
      [["0", "#E6DCCB"], ["1", "#C6B79D"]],
    );
  },
  "nocturne-drive": () => {
    const id = "nocturnedrive";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#070A14"/>
      <path d="M480 500 L300 1000 H700 L520 500Z" fill="#161C2E"/>
      <path d="M500 520 V1000" stroke="#D6A967" stroke-width="3" stroke-dasharray="20 34" opacity=".7"/>
      <path d="M420 540 L150 1000" stroke="#6576B7" opacity=".25"/>
      <path d="M580 540 L850 1000" stroke="#6576B7" opacity=".25"/>
      <path d="M100 760 C 300 700 430 680 500 680" fill="none" stroke="#C94C45" stroke-width="4" opacity=".65"/>
      <path d="M900 820 C 760 760 620 710 500 680" fill="none" stroke="#E7D1A5" stroke-width="3" opacity=".5"/>
      <circle cx="500" cy="420" r="130" fill="#B7C2E0" opacity=".12" filter="url(#blur-wide-${id})"/>
      <circle cx="500" cy="420" r="42" fill="#E3D6BA" opacity=".6"/>
      <text x="82" y="920" font-family="Arial, sans-serif" font-size="21" letter-spacing="8" fill="#EBEBF4" opacity=".68">AURA EDITORIAL</text>
      <text x="918" y="920" text-anchor="end" font-family="Arial, sans-serif" font-size="16" letter-spacing="3" fill="#EBEBF4" opacity=".35">NOCTURNE DRIVE</text>
      `,
      [["0", "#070A14"], ["1", "#0B1020"]],
    );
  },
  "soft-focus": () => {
    const id = "softfocus";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#AEB9B8"/>
      <circle cx="310" cy="330" r="360" fill="#DCE3DE" opacity=".65" filter="url(#blur-wide-${id})"/>
      <circle cx="750" cy="680" r="350" fill="#718987" opacity=".45" filter="url(#blur-wide-${id})"/>
      <rect x="130" y="140" width="740" height="720" fill="none" stroke="#EEF1ED" opacity=".22"/>
      <g stroke="#E7ECE8" stroke-width="1.3" opacity=".5">
        <path d="M250 500 H750"/><path d="M300 530 H700"/><path d="M380 560 H620"/>
      </g>
      <text x="84" y="920" font-family="Arial, sans-serif" font-size="21" letter-spacing="8" fill="#FBFAF6" opacity=".75">AURA EDITORIAL</text>
      <text x="916" y="920" text-anchor="end" font-family="Arial, sans-serif" font-size="16" letter-spacing="3" fill="#FBFAF6" opacity=".44">SOFT FOCUS</text>
      `,
      [["0", "#B6C2BF"], ["1", "#859A97"]],
    );
  },
  "new-light": () => {
    const id = "newlight";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#D8C8B4"/>
      <rect x="0" y="0" width="1000" height="560" fill="#E8D9C1"/>
      <path d="M0 560 H1000 V1000 H0Z" fill="#C46B4D"/>
      <circle cx="716" cy="330" r="165" fill="#E09D78" opacity=".8"/>
      <path d="M0 700 Q 300 640 560 700 T 1000 680 V1000 H0Z" fill="#9E4D38" opacity=".7"/>
      <rect x="136" y="120" width="4" height="570" fill="#37241B" opacity=".6"/>
      <rect x="136" y="120" width="270" height="4" fill="#37241B" opacity=".6"/>
      <text x="138" y="890" font-family="Arial, sans-serif" font-size="21" letter-spacing="8" fill="#F5E9DE" opacity=".8">AURA EDITORIAL</text>
      <text x="868" y="890" text-anchor="end" font-family="Arial, sans-serif" font-size="16" letter-spacing="3" fill="#F5E9DE" opacity=".52">NEW LIGHT</text>
      `,
      [["0", "#E5D7C2"], ["1", "#B46A51"]],
    );
  },
  "blue-room": () => {
    const id = "blueroom";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#0B1718"/>
      <rect x="240" y="140" width="520" height="500" fill="#4E7477" opacity=".24"/>
      <rect x="280" y="180" width="440" height="420" fill="none" stroke="#9EB9B6" opacity=".3"/>
      <path d="M240 140 L0 1000 H1000 L760 640Z" fill="#9DB7B3" opacity=".07"/>
      <circle cx="660" cy="350" r="48" fill="#C4D2C9" opacity=".44" filter="url(#blur-${id})"/>
      <rect x="500" y="680" width="390" height="4" fill="#7E9B97" opacity=".33"/>
      <rect x="500" y="710" width="260" height="2" fill="#7E9B97" opacity=".23"/>
      <text x="82" y="920" font-family="Arial, sans-serif" font-size="21" letter-spacing="8" fill="#DCE7E1" opacity=".67">AURA EDITORIAL</text>
      <text x="918" y="920" text-anchor="end" font-family="Arial, sans-serif" font-size="16" letter-spacing="3" fill="#DCE7E1" opacity=".35">THE BLUE ROOM</text>
      `,
      [["0", "#0D1A1B"], ["1", "#071010"]],
    );
  },
  "sunday-slow": () => {
    const id = "sundayslow";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#C69A77"/>
      <rect y="0" width="1000" height="660" fill="#D7B08A"/>
      <circle cx="642" cy="286" r="144" fill="#EBD3B0" opacity=".88"/>
      <path d="M0 660 Q 330 600 650 665 T 1000 640 V1000 H0Z" fill="#8E6954"/>
      <path d="M0 730 Q 330 690 680 740 T 1000 720 V1000 H0Z" fill="#6A4D3D"/>
      <g stroke="#4C3729" stroke-opacity=".32" stroke-width="2">
        <path d="M112 750 L72 1000"/><path d="M230 765 L330 1000"/><path d="M800 760 L850 1000"/>
      </g>
      <text x="84" y="915" font-family="Arial, sans-serif" font-size="21" letter-spacing="8" fill="#F4E4D1" opacity=".82">AURA EDITORIAL</text>
      <text x="916" y="915" text-anchor="end" font-family="Arial, sans-serif" font-size="16" letter-spacing="3" fill="#F4E4D1" opacity=".5">SUNDAY SLOW</text>
      `,
      [["0", "#D8B28D"], ["1", "#9A7259"]],
    );
  },
  "the-deep-end": () => {
    const id = "deep";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#080A16"/>
      <circle cx="500" cy="180" r="440" fill="#34427A" opacity=".17" filter="url(#blur-wide-${id})"/>
      <path d="M0 0 H1000 V1000 L0 0Z" fill="#1A2142" opacity=".25"/>
      <g fill="none" stroke="#8E9AD4" opacity=".18">
        <circle cx="500" cy="470" r="90"/><circle cx="500" cy="470" r="180"/><circle cx="500" cy="470" r="280"/><circle cx="500" cy="470" r="380"/>
      </g>
      <circle cx="500" cy="470" r="26" fill="#9DA7DE" opacity=".6"/>
      <g fill="#B9C1EE" opacity=".35">
        <circle cx="290" cy="310" r="2"/><circle cx="690" cy="230" r="1.5"/><circle cx="760" cy="600" r="2.3"/>
      </g>
      <text x="84" y="920" font-family="Arial, sans-serif" font-size="21" letter-spacing="8" fill="#E1E4F6" opacity=".68">AURA EDITORIAL</text>
      <text x="916" y="920" text-anchor="end" font-family="Arial, sans-serif" font-size="16" letter-spacing="3" fill="#E1E4F6" opacity=".35">THE DEEP END</text>
      `,
      [["0", "#080A16"], [".5", "#10152C"], ["1", "#06070D"]],
    );
  },
  "aura-radio-mira": () => {
    const id = "auramira";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#210F17"/>
      <circle cx="500" cy="470" r="310" fill="#8A435E" opacity=".38" filter="url(#blur-wide-${id})"/>
      <path d="M355 680 C 320 570 335 430 410 380 H590 C 665 430 680 570 645 680Z" fill="#C3838D" opacity=".28" filter="url(#blur-${id})"/>
      <circle cx="500" cy="365" r="96" fill="#D6A5A0" opacity=".28" filter="url(#blur-${id})"/>
      <g fill="none" stroke="#E4C4B7" opacity=".27">
        <circle cx="500" cy="470" r="240"/><circle cx="500" cy="470" r="360"/>
      </g>
      <text x="500" y="810" text-anchor="middle" font-family="Arial, sans-serif" font-size="19" letter-spacing="10" fill="#F3DDD4" opacity=".53">AURA RADIO</text>
      <text x="500" y="850" text-anchor="middle" font-family="Georgia, serif" font-size="31" font-style="italic" fill="#F3DDD4" opacity=".78">Mira Vale</text>
      `,
      [["0", "#241019"], ["1", "#10080C"]],
    );
  },
  "empty-streets": () => {
    const id = "emptystreets";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#11151A"/>
      <rect y="580" width="1000" height="420" fill="#161B21"/>
      <path d="M500 580 L170 1000 H830 Z" fill="#1E242B"/>
      <path d="M500 580 V1000" stroke="#B3A477" stroke-width="2" opacity=".3" stroke-dasharray="16 30"/>
      <circle cx="500" cy="410" r="240" fill="#798A98" opacity=".1" filter="url(#blur-wide-${id})"/>
      <circle cx="500" cy="410" r="46" fill="#C4C3AE" opacity=".35" filter="url(#blur-${id})"/>
      <path d="M500 0 V410" stroke="#C7C6B1" opacity=".14" stroke-width="2"/>
      <rect x="70" y="70" width="860" height="860" fill="none" stroke="#D8D7C9" opacity=".1"/>
      <text x="84" y="920" font-family="Arial, sans-serif" font-size="21" letter-spacing="8" fill="#E2E3DD" opacity=".61">AURA EDITORIAL</text>
      <text x="916" y="920" text-anchor="end" font-family="Arial, sans-serif" font-size="16" letter-spacing="3" fill="#E2E3DD" opacity=".32">EMPTY STREETS</text>
      `,
      [["0", "#12171C"], ["1", "#090C0F"]],
    );
  },
};

// Private playlist covers used by the seeded and newly-created user playlists.
const userPlaylistArt = {
  "user-01": () => {
    const id = "userone";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#0B0A10"/>
      <circle cx="320" cy="310" r="300" fill="#6A4A8C" opacity=".34" filter="url(#blur-wide-${id})"/>
      <circle cx="740" cy="690" r="350" fill="#2E3548" opacity=".48" filter="url(#blur-wide-${id})"/>
      <circle cx="500" cy="470" r="230" fill="none" stroke="#C9B7E8" opacity=".19"/>
      <circle cx="500" cy="470" r="164" fill="none" stroke="#C9B7E8" opacity=".12"/>
      <path d="M-30 690 C 220 590 330 780 520 660 S 790 570 1030 680" fill="none" stroke="#D7C8EA" stroke-width="1.3" opacity=".28"/>
      <g fill="#E7DCF2" opacity=".5"><circle cx="250" cy="240" r="2"/><circle cx="760" cy="330" r="1.5"/><circle cx="620" cy="760" r="1.8"/></g>
      <text x="500" y="848" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" letter-spacing="10" fill="#EDE6F3" opacity=".55">YOUR PLAYLIST</text>
      `,
      [["0", "#0C0B11"], [".55", "#1A1427"], ["1", "#08070C"]],
    );
  },
  "user-02": () => {
    const id = "usertwo";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#10171A"/>
      <rect y="520" width="1000" height="480" fill="#0B1012"/>
      <circle cx="670" cy="330" r="270" fill="#6B8D91" opacity=".22" filter="url(#blur-wide-${id})"/>
      <path d="M0 560 Q 250 500 500 555 T 1000 535" fill="none" stroke="#C7D7D4" stroke-width="1.2" opacity=".24"/>
      <path d="M0 630 Q 260 575 520 625 T 1000 605" fill="none" stroke="#C7D7D4" stroke-width="1" opacity=".15"/>
      <g stroke="#C7D7D4" opacity=".15"><path d="M100 160 H900"/><path d="M100 200 H900"/></g>
      <circle cx="330" cy="380" r="7" fill="#D5E2DD" opacity=".5"/>
      <text x="500" y="848" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" letter-spacing="10" fill="#DFE8E4" opacity=".55">WINTER WALK</text>
      `,
      [["0", "#111A1C"], [".55", "#23383B"], ["1", "#080C0D"]],
    );
  },
  "user-03": () => {
    const id = "userthree";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#1A100B"/>
      <circle cx="500" cy="500" r="380" fill="#8C4B2E" opacity=".2" filter="url(#blur-wide-${id})"/>
      <circle cx="500" cy="470" r="210" fill="#D5A06E" opacity=".14" filter="url(#blur-${id})"/>
      <g transform="translate(500 470)" stroke="#E0B88B" opacity=".22">
        ${Array.from({ length: 6 }, (_, i) => `<circle r="${80 + i * 34}"/>`).join("")}
      </g>
      <path d="M90 710 C 280 650 400 760 510 650 S 760 620 910 700" fill="none" stroke="#E0B88B" stroke-width="1.2" opacity=".25"/>
      <text x="500" y="848" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" letter-spacing="10" fill="#F1DCC7" opacity=".55">YOUR PLAYLIST</text>
      `,
      [["0", "#1B110C"], [".55", "#3C2419"], ["1", "#0C0806"]],
    );
  },
  "user-04": () => {
    const id = "userfour";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#0B111A"/>
      <path d="M0 0 H1000 V1000 L0 0Z" fill="#23344A" opacity=".28"/>
      <circle cx="700" cy="300" r="280" fill="#556F96" opacity=".18" filter="url(#blur-wide-${id})"/>
      <g stroke="#B8CAE1" opacity=".16">
        <path d="M170 820 L500 120"/><path d="M350 860 L620 150"/><path d="M540 900 L760 200"/>
      </g>
      <circle cx="500" cy="500" r="8" fill="#D3E0F0" opacity=".4"/>
      <text x="500" y="848" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" letter-spacing="10" fill="#D9E3F0" opacity=".55">YOUR PLAYLIST</text>
      `,
      [["0", "#0C121C"], [".55", "#182B40"], ["1", "#070A0E"]],
    );
  },
  "user-05": () => {
    const id = "userfive";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#15100C"/>
      <rect x="120" y="120" width="760" height="760" fill="none" stroke="#E0C59A" opacity=".12"/>
      <circle cx="360" cy="410" r="210" fill="#A57B4E" opacity=".2" filter="url(#blur-wide-${id})"/>
      <circle cx="690" cy="620" r="180" fill="#5D6247" opacity=".22" filter="url(#blur-${id})"/>
      <g fill="none" stroke="#EAD4AE" opacity=".2">
        <path d="M120 700 H880"/><path d="M120 646 H620"/><path d="M120 754 H440"/>
      </g>
      <text x="500" y="848" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" letter-spacing="10" fill="#F2E4CB" opacity=".55">YOUR PLAYLIST</text>
      `,
      [["0", "#17110C"], [".55", "#2E2419"], ["1", "#0B0806"]],
    );
  },
  "user-06": () => {
    const id = "usersix";
    return svg(
      id,
      `
      <rect width="1000" height="1000" fill="#130D17"/>
      <circle cx="500" cy="480" r="360" fill="#5D3A76" opacity=".3" filter="url(#blur-wide-${id})"/>
      <circle cx="500" cy="480" r="186" fill="#A986C4" opacity=".12" filter="url(#blur-${id})"/>
      <g transform="translate(500 480)">
        ${Array.from({ length: 18 }, (_, i) => {
          const angle = (i / 18) * 360;
          return `<rect x="-2" y="-260" width="4" height="${70 + (i % 5) * 34}" rx="2" fill="#DCC8EA" opacity="${0.1 + (i % 4) * 0.045}" transform="rotate(${angle})"/>`;
        }).join("")}
        <circle r="58" fill="#E3CFEF" opacity=".2"/>
      </g>
      <text x="500" y="848" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" letter-spacing="10" fill="#E9DDF0" opacity=".55">YOUR PLAYLIST</text>
      `,
      [["0", "#150F19"], [".55", "#2A1B34"], ["1", "#0A070C"]],
    );
  },
};

const genreArt = {
  ambient: ["#121420", "#3E466B", "#8B95C8", `
    <circle cx="300" cy="390" r="280" fill="#8795C7" opacity=".22" filter="url(#blur-wide-ambient)"/>
    <circle cx="720" cy="620" r="320" fill="#4F5B86" opacity=".33" filter="url(#blur-wide-ambient)"/>
    <path d="M100 650 Q 300 580 500 650 T 900 630" fill="none" stroke="#C5CBE5" stroke-width="1.2" opacity=".34"/>
    <path d="M100 700 Q 300 630 500 700 T 900 680" fill="none" stroke="#C5CBE5" stroke-width="1.2" opacity=".2"/>`],
  electronic: ["#100A1B", "#3E1E61", "#A855F7", `
    <g stroke="#A987E7" opacity=".25">
      ${Array.from({ length: 10 }, (_, i) => `<path d="M${100 + i * 90} 100 V900"/>`).join("")}
      ${Array.from({ length: 10 }, (_, i) => `<path d="M100 ${100 + i * 90} H900"/>`).join("")}
    </g>
    <circle cx="500" cy="500" r="210" fill="none" stroke="#C8A6FF" opacity=".4"/>
    <circle cx="500" cy="500" r="120" fill="#A855F7" opacity=".24" filter="url(#blur-electronic)"/>
    <circle cx="500" cy="500" r="18" fill="#D8C3FF" opacity=".7"/>`],
  alternative: ["#1A0D0C", "#5B2722", "#E27766", `
    <path d="M0 0 H1000 V1000 H0Z" fill="none"/>
    <path d="M110 720 C 260 420 380 180 620 280 S 890 620 780 880" fill="none" stroke="#E27766" stroke-width="150" opacity=".19" filter="url(#blur-alternative)"/>
    <path d="M210 760 C 330 520 410 320 590 380 S 770 610 690 840" fill="none" stroke="#F2C1B5" stroke-width="2" opacity=".3"/>
    <path d="M160 820 C 380 760 610 900 900 760" fill="none" stroke="#E27766" stroke-width="34" opacity=".12"/>`],
  soul: ["#1A120C", "#48311E", "#D3A26B", `
    <circle cx="500" cy="500" r="300" fill="none" stroke="#D3A26B" opacity=".38"/>
    <circle cx="500" cy="500" r="215" fill="none" stroke="#D3A26B" opacity=".26"/>
    <path d="M500 200 C 660 280 720 440 660 620 C 600 800 400 800 340 620 C 280 440 340 280 500 200Z" fill="#C08B52" opacity=".23" filter="url(#blur-soul)"/>
    <path d="M500 310 C 590 360 620 460 590 570 C 560 680 440 680 410 570 C 380 460 410 360 500 310Z" fill="#D3A26B" opacity=".2"/>`],
  jazz: ["#0A1514", "#1D3A36", "#71A39B", `
    <path d="M200 780 C 260 560 380 480 420 700 C 450 840 540 840 580 700 C 620 500 760 520 800 260" fill="none" stroke="#71A39B" stroke-width="2" opacity=".35"/>
    <path d="M160 800 C 300 660 480 590 540 760 C 580 870 700 700 850 580" fill="none" stroke="#B6D1CD" stroke-width="1" opacity=".2"/>
    <circle cx="690" cy="350" r="145" fill="#3A5D59" opacity=".3" filter="url(#blur-jazz)"/>
    <circle cx="690" cy="350" r="38" fill="#B2CBC6" opacity=".16"/>`],
  indie: ["#151A14", "#3A4027", "#BFA76B", `
    <circle cx="500" cy="460" r="240" fill="#D3BF87" opacity=".13" filter="url(#blur-indie)"/>
    <path d="M0 640 Q 220 560 440 640 T 1000 620 V1000 H0Z" fill="#22281B" opacity=".8"/>
    <path d="M0 720 Q 250 680 520 730 T 1000 700 V1000 H0Z" fill="#11150F"/>
    <g stroke="#BFA76B" opacity=".2"><path d="M100 240 H900"/><path d="M100 290 H900"/></g>`],
  cinematic: ["#0D0F1D", "#303858", "#8C9EFF", `
    <circle cx="500" cy="570" r="360" fill="#7987C9" opacity=".17" filter="url(#blur-wide-cinematic)"/>
    <circle cx="500" cy="570" r="152" fill="#ABB7ED" opacity=".17" filter="url(#blur-cinematic)"/>
    <path d="M0 690 Q 280 640 500 675 T 1000 660 V1000 H0Z" fill="#090A12"/>
    <path d="M0 760 Q 300 730 500 770 T 1000 740 V1000 H0Z" fill="#05060A"/>
    <g stroke="#B8C2F5" opacity=".15"><path d="M80 220 H920"/><path d="M80 260 H920"/></g>`],
  downtempo: ["#120D18", "#342044", "#9B7BB8", `
    <g filter="url(#blur-downtempo)">
      <circle cx="360" cy="440" r="230" fill="#7E5898" opacity=".3"/>
      <circle cx="680" cy="580" r="260" fill="#48395A" opacity=".4"/>
    </g>
    <path d="M120 620 C 260 460 360 720 500 560 S 760 460 880 600" fill="none" stroke="#B9A1CE" stroke-width="1.5" opacity=".3"/>
    <path d="M120 680 C 260 520 360 780 500 620 S 760 520 880 660" fill="none" stroke="#B9A1CE" stroke-width="1" opacity=".18"/>
    <circle cx="500" cy="500" r="7" fill="#D8C7E5" opacity=".5"/>`],
};

const artistImages = {
  "elio-north": ["#A6AEB2", "#20262A", "#E7EAE7", 1],
  "mira-vale": ["#9A606C", "#240F18", "#F0C4B8", 2],
  "sable-coast": ["#567A77", "#081210", "#CDDDD7", 3],
  "noa-ito": ["#95A09F", "#111819", "#E5EEEA", 4],
  "aster-house": ["#85847C", "#1F201D", "#E4E2D7", 5],
  "julien-arlo": ["#784554", "#1B0A11", "#E5C6A8", 6],
  "lumen-kite": ["#817E9F", "#151425", "#E4DFEE", 7],
  "vera-sol": ["#A57B54", "#21160C", "#EBD8B8", 8],
  "paper-moons": ["#9C8E72", "#211E16", "#E9E0CA", 9],
  "kairos": ["#586C98", "#070C18", "#D3DEF5", 10],
  "iris-ember": ["#A25E53", "#1C0B09", "#F1CFC1", 11],
  northbound: ["#6D7C87", "#0C1419", "#DCE5E7", 12],
};

function artistSvg(id, [bg, dark, light, variant]) {
  const flip = variant % 2 === 0;
  const cx = 500 + (flip ? -55 : 55);
  const shoulder = variant % 3 === 0 ? 250 : 320;
  return svg(
    `artist${variant}`,
    `
    <circle cx="${cx}" cy="445" r="310" fill="${light}" opacity=".08" filter="url(#blur-artist${variant})"/>
    <rect x="0" y="0" width="1000" height="1000" fill="${dark}" opacity=".18"/>
    <path d="M150 1000 C 190 780 320 690 500 680 C 680 690 810 780 850 1000Z" fill="${dark}" opacity=".93"/>
    <ellipse cx="${cx}" cy="445" rx="188" ry="244" fill="${dark}" opacity=".96"/>
    <ellipse cx="${cx - 30}" cy="390" rx="132" ry="208" fill="${light}" opacity=".09"/>
    <path d="M${cx - 153} 340 C ${cx - 190} 250 ${cx - 90} 155 ${cx + 30} 165 C ${cx + 180} 180 ${cx + 220} 320 ${cx + 150} 430 C ${cx + 95} 340 ${cx + 30} 295 ${cx - 70} 320Z" fill="${dark}"/>
    <path d="M120 1000 C 180 760 330 690 500 685 C 280 760 255 860 240 1000Z" fill="${light}" opacity=".06"/>
    <g stroke="${light}" opacity=".15">
      <path d="M80 ${180 + variant * 11} H920"/><path d="M80 ${215 + variant * 11} H920"/>
    </g>
    <circle cx="820" cy="200" r="${20 + (variant % 4) * 8}" fill="${light}" opacity=".1" filter="url(#blur-artist${variant})"/>
    <rect x="0" y="0" width="1000" height="1000" fill="url(#bg-artist${variant})" opacity=".16"/>
    `,
    [
      ["0", bg],
      [".55", dark],
      ["1", "#08090A"],
    ],
    `<radialGradient id="artistglow${variant}" cx="50%" cy="35%" r="50%"><stop offset="0" stop-color="${light}" stop-opacity=".2"/><stop offset="1" stop-color="${dark}" stop-opacity="0"/></radialGradient>`,
  );
}

function write(dir, name, content) {
  fs.writeFileSync(path.join(root, dir, `${name}.svg`), content);
}

for (const [name, make] of Object.entries(albums)) write("albums", name, make());
for (const [name, make] of Object.entries(playlistArt)) write("playlists", name, make());
for (const [name, make] of Object.entries(userPlaylistArt)) write("playlists", name, make());
for (const [name, [a, b, c, body]] of Object.entries(genreArt)) {
  write("genres", name, svg(`genre${name}`, body, [["0", a], [".55", b], ["1", a]]));
}
for (const [name, palette] of Object.entries(artistImages)) {
  // Add a glow filter for each artist's unique generated id.
  const content = artistSvg(name, palette).replace(
    `</defs>`,
    `<radialGradient id="glow-${name}" cx="50%" cy="40%" r="55%"><stop offset="0" stop-color="${palette[2]}" stop-opacity=".12"/><stop offset="1" stop-color="${palette[1]}" stop-opacity="0"/></radialGradient></defs>`,
  );
  write("artists", name, content.replace(
    `<rect x="0" y="0" width="1000" height="1000" fill="url(#bg-artist`,
    `<rect x="0" y="0" width="1000" height="1000" fill="url(#glow-${name})"/><rect x="0" y="0" width="1000" height="1000" fill="url(#bg-artist`,
  ));
}

// Brand mark.
const brand = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <rect width="48" height="48" rx="14" fill="#8B5CF6"/>
  <g fill="#F5F3FA">
    <rect x="12" y="20" width="3.4" height="8" rx="1.7"/>
    <rect x="18.2" y="15" width="3.4" height="18" rx="1.7"/>
    <rect x="24.4" y="11" width="3.4" height="26" rx="1.7"/>
    <rect x="30.6" y="18" width="3.4" height="12" rx="1.7"/>
  </g>
</svg>`;
fs.writeFileSync(path.join(root, "..", "aura-mark.svg"), brand);

// Generated artwork provenance / license note.
fs.writeFileSync(
  path.join(root, "README.md"),
  `# AURA artwork\n\nAll artwork in this directory is original, procedurally generated abstract artwork created for this demo project. It is included under the same license as the project and is safe to use locally.\n`,
);

console.log(
  `Generated ${Object.keys(albums).length} album covers, ${Object.keys(artistImages).length} artist images, ${Object.keys(playlistArt).length} playlist covers and ${Object.keys(genreArt).length} genre images.`,
);
