/* warmtepomp-cards v1.1.0 — heatpump-monoblock-card (MIT) */
/* heatpump-monoblock-card v1.0.0 — geanimeerde monoblock-warmtepomp met open verdeler, circulatiepomp en radiatoren in serie (fork B0bWa)
 * https://github.com/AMensink/warmtepomp-cards — MIT-licentie
 * Stel je eigen entiteiten in onder `entities:` in de kaart-YAML; zie README.
 */
const HPM_DEFAULTS = {
  supply: "sensor.warmtepomp_outlet_water_temperature",
  return: "sensor.warmtepomp_inlet_water_temperature",
  ambient: "sensor.warmtepomp_ambient_temperature",
  coil: "sensor.warmtepomp_coil_temperature",
  exhaust: "sensor.warmtepomp_exhaust_temperature",
  suction: "sensor.warmtepomp_suction_temperature",
  hp_sat: "sensor.warmtepomp_high_pressure_saturation_temperature",
  internal_coil: "sensor.warmtepomp_internal_coil_temperature",
  eev: "sensor.warmtepomp_main_valve_pressure",
  flow: "sensor.warmtepomp_water_flow_rate",
  fan_hz: "sensor.warmtepomp_fan_frequency",
  comp_hz: "sensor.warmtepomp_compressor_frequency",
  compressor: "binary_sensor.warmtepomp_compressor_state",
  defrost: "binary_sensor.warmtepomp_defrost_state",
  online: "binary_sensor.warmtepomp_online_status",
  fault: "sensor.warmtepomp_fault_codes",
  power_switch: "switch.warmtepomp_power",
  setpoint: "number.warmtepomp_temperature_setpoint",
  mode: "select.warmtepomp_mode",
  work_mode: "select.warmtepomp_work_mode",
  curve: "select.warmtepomp_curve_setting",
  power: "sensor.warmtepomp_power",
  energy_today: "sensor.warmtepomp_today_s_energy",
  energy_total: "sensor.warmtepomp_total_energy",
  thermostat: null,
};
const HPM_MODE_NL = {
  Cooling: "Koelen", Heating: "Verwarmen", "Floor Heating": "Vloerverwarming", "Hot Water": "Warm water",
  "Cooling + Hot Water": "Koelen + warm water", "Heating + Hot Water": "Verwarmen + warm water",
  "Floor Heating + Hot Water": "Vloerverw. + warm water",
};
const HPM_WORK_NL = { ECO: "Eco", Normal: "Normaal", Boost: "Boost" };

class HeatpumpMonoblockCard extends HTMLElement {
  static getStubConfig() { return {}; }
  setConfig(config) {
    this._config = { title: "Warmtepomp", buffer_liters: 25, pump_label: "Wilo · stand I", radiators: ["Woonkamer", "Bijkeuken", "Badkamer", "Gang", "Slaapkamer", "Leefruimte"], ...config };
    this._e = { ...HPM_DEFAULTS, ...(config.entities || {}) };
    if (this._root) this._render();
  }
  getCardSize() { return 10; }
  getGridOptions() { return { columns: "full", rows: "auto", min_columns: 6 }; }
  set hass(hass) { this._hass = hass; if (!this._root) this._render(); this._update(); }

  _st(k) { const id = this._e[k]; return id && this._hass ? this._hass.states[id] : undefined; }
  _num(k) { const s = this._st(k); if (!s) return NaN; const v = parseFloat(s.state); return Number.isFinite(v) ? v : NaN; }
  _on(k) { const s = this._st(k); if (!s) return false; return !["off", "0", "0.0", "false", "unavailable", "unknown", "none", ""].includes(String(s.state).toLowerCase()); }
  _fmt(v, d = 0) { return Number.isFinite(v) ? v.toFixed(d).replace(".", ",") : "–"; }
  _unit(k, fb = "") { const s = this._st(k); return (s && s.attributes.unit_of_measurement) || fb; }
  _room() {
    const th = this._st("thermostat"), v = th ? parseFloat(th.attributes.current_temperature) : NaN;
    return Number.isFinite(v) ? v : 20;
  }
  // blauw alleen onder de gemeten kamertemperatuur (thermostaat), daarboven warm oplopend naar rood
  _col(t) {
    const R = this._room();
    const S = t < R
      ? [[R - 10, [59, 130, 246]], [R, [110, 175, 245]]]
      : [[R, [245, 200, 90]], [Math.max(R + 6, 33), [245, 165, 60]], [Math.max(R + 12, 42), [245, 110, 40]], [Math.max(R + 20, 55), [215, 40, 40]]];
    if (!Number.isFinite(t)) return "rgb(130,135,140)";
    if (t <= S[0][0]) return `rgb(${S[0][1]})`;
    for (let i = 1; i < S.length; i++) if (t <= S[i][0]) {
      const [a, c0] = S[i - 1], [b, c1] = S[i], f = (t - a) / (b - a);
      return `rgb(${c0.map((c, j) => Math.round(c + (c1[j] - c) * f)).join(",")})`;
    }
    return `rgb(${S[S.length - 1][1]})`;
  }
  _more(k) {
    const entityId = this._e[k]; if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }
  _pump(id, cx, cy, r, k) {
    return `<g class="click" data-k="${k}">
      <circle cx="${cx}" cy="${cy}" r="${r}" class="pumpbody" id="${id}-body"/>
      <g id="${id}" style="transform-origin:${cx}px ${cy}px;transform-box:view-box"><path d="M${cx} ${cy} l0 -${r * 0.65} M${cx} ${cy} l${r * 0.56} ${r * 0.33} M${cx} ${cy} l-${r * 0.56} ${r * 0.33}" stroke="var(--primary-text-color,#333)" stroke-width="2.2" stroke-linecap="round"/></g>
    </g>`;
  }

  _render() {
    if (!this._root) this._root = this.attachShadow({ mode: "open" });
    const L = (k, x, y, lbl, id, anchor = "start") =>
      `<g class="click" data-k="${k}"><text class="lbl" x="${x}" y="${y}" text-anchor="${anchor}">${lbl}</text><text class="val" x="${x}" y="${y + 17}" id="${id}" text-anchor="${anchor}">–</text></g>`;
    this._root.innerHTML = `
<style>
  :host{display:block}
  ha-card{padding:12px 12px 14px;overflow:hidden}
  .head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 6px 6px}
  .title{font-size:1.15rem;font-weight:600;color:var(--primary-text-color)}
  .status{font-size:.85rem;padding:4px 10px;border-radius:999px;background:var(--secondary-background-color,rgba(127,127,127,.15));color:var(--primary-text-color);white-space:nowrap}
  .status.heat{background:rgba(245,110,40,.18);color:rgb(230,100,30)}
  .status.cool{background:rgba(59,130,246,.16);color:rgb(59,130,246)}
  .status.defrost{background:rgba(59,130,246,.16);color:rgb(59,130,246)}
  .status.fault{background:rgba(220,40,40,.2);color:rgb(210,45,45)}
  svg{width:100%;height:auto;display:block}
  .outside{fill:rgba(90,165,240,.07)}
  .wall{fill:var(--secondary-background-color,#eee);stroke:var(--divider-color,#ccc)}
  .hatch{stroke:var(--divider-color,#bbb);stroke-width:1.5}
  .housing{fill:var(--card-background-color,#fff);stroke:var(--secondary-text-color,#999);stroke-width:2.5}
  .grille{fill:none;stroke:var(--divider-color,#ccc);stroke-width:1.5}
  .blade{fill:var(--secondary-text-color,#888)}
  .hub{fill:var(--primary-text-color,#444)}
  .comp{fill:var(--secondary-text-color,#888)}
  .led{fill:#777}
  .phe{fill:var(--secondary-background-color,#eee);stroke:var(--secondary-text-color,#999);stroke-width:1.5}
  .lbl{fill:var(--secondary-text-color,#777);font-size:11px;font-family:var(--paper-font-body1_-_font-family,sans-serif)}
  .val{fill:var(--primary-text-color,#222);font-size:15px;font-weight:600;font-family:var(--paper-font-body1_-_font-family,sans-serif)}
  .zone{fill:var(--secondary-text-color,#999);font-size:10px;letter-spacing:.12em;font-family:var(--paper-font-body1_-_font-family,sans-serif)}
  .click{cursor:pointer}
  .click:hover .val{text-decoration:underline}
  .pipe{fill:none;stroke-width:8;stroke-linecap:round;stroke-linejoin:round;opacity:.45}
  .flow{fill:none;stroke-width:3.5;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:2 12;opacity:0}
  .shell{fill:none;stroke:var(--secondary-text-color,#888);stroke-width:2.5}
  .big{font-size:18px;font-weight:700;fill:#fff;paint-order:stroke;stroke:rgba(0,0,0,.25);stroke-width:2px}
  .sub{font-size:10px;fill:rgba(255,255,255,.95);paint-order:stroke;stroke:rgba(0,0,0,.25);stroke-width:1px}
  .rad{stroke:var(--card-background-color,#fff);stroke-width:2}
  .air{fill:none;stroke:rgba(80,150,250,.8);stroke-width:2.5;stroke-dasharray:6 8;stroke-linecap:round;opacity:0}
  .snow{opacity:0}
  .manifold{fill:var(--secondary-background-color,#eee);stroke:var(--secondary-text-color,#888);stroke-width:2}
  .mstub{stroke:var(--secondary-text-color,#888);stroke-width:2;stroke-linecap:round}
  #fan{transform-origin:95px 175px;transform-box:view-box}
  .fan-on #fan{animation:spin var(--fan-s,1s) linear infinite}
  .fan-on .air{opacity:1;animation:dash 1s linear infinite}
  .flow-on .flow.pri{opacity:1;animation:dash var(--flow-s,1.2s) linear infinite}
  .sec-on .flow.sec{opacity:1;animation:dash 1.3s linear infinite}
  .comp-on #comp{animation:hum .18s ease-in-out infinite alternate}
  .comp-on .led{fill:rgb(60,200,90)}
  .defrost .snow{opacity:1;animation:pulse 2s ease-in-out infinite}
  .buf{transition:fill 1.2s ease}
  .pumpbody{fill:var(--card-background-color,#fff);stroke:var(--secondary-text-color,#888);stroke-width:2.5;transition:stroke .4s}
  .sec-on #cvpump-body{stroke:rgb(60,200,90)}
  .sec-on #cvpump{animation:spin .8s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes dash{to{stroke-dashoffset:-28}}
  @keyframes hum{from{transform:translate(0,0)}to{transform:translate(.8px,-.6px)}}
  @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
  @keyframes wave{0%{transform:translateY(0);opacity:0}30%{opacity:.8}100%{transform:translateY(-16px);opacity:0}}
  @media (prefers-reduced-motion:reduce){*{animation:none!important}}
  .chips{display:flex;flex-wrap:wrap;gap:6px;padding:6px 4px 0}
  .chip{display:flex;align-items:center;gap:6px;font-size:.8rem;padding:4px 10px;border-radius:999px;background:var(--secondary-background-color,rgba(127,127,127,.12));color:var(--secondary-text-color);cursor:pointer;user-select:none}
  .chip .dot{width:8px;height:8px;border-radius:50%;background:rgba(127,127,127,.5)}
  .chip.on{color:var(--primary-text-color)}
  .chip.on .dot{background:rgb(60,200,90);box-shadow:0 0 6px rgb(60,200,90)}
  .chip.warn.on .dot{background:rgb(220,40,40);box-shadow:0 0 6px rgb(220,40,40)}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;padding:10px 4px 0}
  .stat{background:var(--secondary-background-color,rgba(127,127,127,.1));border-radius:12px;padding:8px 10px;cursor:pointer}
  .stat .k{font-size:.75rem;color:var(--secondary-text-color)}
  .stat .v{font-size:1.05rem;font-weight:600;color:var(--primary-text-color);margin-top:2px}
</style>
<ha-card>
  <div class="head"><div class="title">${this._config.title}</div><div class="status" id="status">–</div></div>
  <svg id="svg" viewBox="0 0 640 420" role="img" aria-label="Warmtepomp">
    <defs>
      <clipPath id="hpm-buf"><rect x="322" y="26" width="56" height="384" rx="12"/></clipPath>
      <linearGradient id="hpm-bufg" x1="0" y1="0" x2="0" y2="1"><stop id="b-top" offset="0"/><stop id="b-bot" offset="1"/></linearGradient>
      <linearGradient id="hpm-shine" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".2" stop-color="#fff" stop-opacity=".25"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient>
    </defs>
    <rect class="outside" x="0" y="0" width="262" height="420" rx="10"/>
    <text class="zone" x="12" y="18">BUITEN</text>
    <rect class="wall" x="262" y="0" width="22" height="420"/>
    ${Array.from({ length: 22 }, (_, i) => `<line class="hatch" x1="262" y1="${i * 20}" x2="284" y2="${i * 20 + 14}"/>`).join("")}

    <!-- monoblock -->
    <rect class="housing" x="18" y="80" width="230" height="200" rx="12"/>
    <rect x="30" y="280" width="16" height="14" class="comp"/><rect x="220" y="280" width="16" height="14" class="comp"/>
    <circle class="grille" cx="95" cy="175" r="66"/><circle class="grille" cx="95" cy="175" r="48"/><circle class="grille" cx="95" cy="175" r="30"/>
    <line class="grille" x1="29" y1="175" x2="161" y2="175"/><line class="grille" x1="95" y1="109" x2="95" y2="241"/>
    <g id="fan">${[0, 120, 240].map((a) => `<path class="blade" transform="rotate(${a} 95 175)" d="M95 175 C 100 140, 128 128, 140 142 C 130 160, 112 170, 95 175 Z"/>`).join("")}<circle class="hub" cx="95" cy="175" r="9"/></g>
    <path class="air" d="M17 130 C 9 130, 9 118, 3 112"/><path class="air" d="M17 220 C 9 220, 9 232, 3 238"/>
    <g id="comp"><rect class="comp" x="176" y="118" width="40" height="78" rx="18"/><rect class="comp" x="184" y="108" width="24" height="13" rx="5"/><circle class="led" cx="196" cy="182" r="4.5"/></g>
    <rect class="phe" x="178" y="212" width="36" height="54" rx="4"/>
    ${[0, 1, 2, 3, 4].map((i) => `<line class="grille" x1="182" y1="${220 + i * 10}" x2="210" y2="${220 + i * 10}"/>`).join("")}
    <g class="snow" transform="translate(95 175)"><path d="M0 -14 V14 M-12 -7 L12 7 M-12 7 L12 -7" stroke="rgb(80,150,250)" stroke-width="3" stroke-linecap="round"/></g>
    ${L("ambient", 12, 40, "Buitenlucht", "v-amb")}
    ${L("coil", 100, 40, "Verdamper", "v-coil")}
    ${L("exhaust", 180, 40, "Persgas", "v-exh")}
    ${L("suction", 30, 300, "Zuiggas", "v-suc")}
    ${L("comp_hz", 100, 300, "Compressor", "v-comp")}
    ${L("fan_hz", 180, 300, "Ventilator", "v-fan")}
    ${L("hp_sat", 30, 350, "Condensatie", "v-hps")}
    ${L("eev", 120, 350, "Exp.ventiel", "v-eev")}

    ${L("flow", 30, 390, "Debiet", "v-flow")}
    ${L("setpoint", 120, 390, "Doel aanvoer", "v-set")}

    <!-- primair: buitenunit ↔ open verdeler (circulatie warmtepomp) -->
    <path class="pipe" id="p-sup" d="M214 222 H 294 V 50 H 322"/>
    <path class="flow pri" id="f-sup" d="M214 222 H 294 V 50 H 322"/>
    <path class="pipe" id="p-ret" d="M322 380 H 308 V 256 H 214"/>
    <path class="flow pri" id="f-ret" d="M322 380 H 308 V 256 H 214"/>

    <!-- open verdeler -->
    <g class="click" data-k="supply">
      <g clip-path="url(#hpm-buf)"><rect class="buf" x="322" y="26" width="56" height="384" fill="url(#hpm-bufg)"/><rect x="322" y="26" width="56" height="384" fill="url(#hpm-shine)"/></g>
      <rect class="shell" x="322" y="26" width="56" height="384" rx="12"/>
      <text class="big" x="350" y="214" text-anchor="middle" id="v-buf">–</text>
      <text class="sub" x="350" y="230" text-anchor="middle">${this._config.buffer_liters} L</text>
      <text class="sub" x="350" y="243" text-anchor="middle">open</text>
      <text class="sub" x="350" y="256" text-anchor="middle">verdeler</text>
    </g>
    ${L("supply", 470, 14, "Aanvoer", "v-sup")}
    ${L("return", 530, 14, "Retour", "v-ret")}
    ${L("dt", 590, 14, "ΔT", "v-dt")}

    <!-- secundair: radiatoren in serie (aanvoer → woonkamer → … → retour) -->
    <path class="pipe" id="p-a" d="M378 50 H 412 V 110 H 622 V 230"/>
    <path class="flow sec" id="f-a" d="M378 50 H 412 V 110 H 622 V 230"/>
    <path class="pipe" id="p-b" d="M622 230 H 412 V 350"/>
    <path class="flow sec" id="f-b" d="M622 230 H 412 V 350"/>
    <path class="pipe" id="p-c" d="M412 350 H 622 V 400 H 378"/>
    <path class="flow sec" id="f-c" d="M412 350 H 622 V 400 H 378"/>
    ${this._pump("cvpump", 398, 50, 11, "thermostat")}
    <text class="lbl" x="386" y="32" text-anchor="start">${this._config.pump_label}</text>

    ${this._config.radiators.slice(0, 6).map((name, i) => {
      const col = [0, 1, 1, 0, 0, 1], row = [0, 0, 1, 1, 2, 2];
      const x0 = col[i] ? 530 : 420, cy = [110, 230, 350][row[i]];
      const fins = Array.from({ length: 7 }, (_, f) => `<rect class="rad radcol" x="${x0 + f * 11}" y="${cy - 26}" width="9" height="52" rx="4"/>`).join("");
      return `<g>${fins}<text class="lbl" x="${x0 + 38}" y="${cy - 32}" text-anchor="middle">${name}</text></g>`;
    }).join("")}
    ${L("thermostat", 420, 264, "EMOS thermostaat", "v-emos")}
  </svg>
  <div class="chips">
    <div class="chip" data-k="comp_hz" id="c-comp"><span class="dot"></span>Compressor</div>
    <div class="chip" data-k="fan_hz" id="c-fan"><span class="dot"></span>Ventilator</div>
    <div class="chip" data-k="flow" id="c-flow"><span class="dot"></span>Circulatie WP</div>
    <div class="chip" data-k="thermostat" id="c-cv"><span class="dot"></span>Circulatiepomp</div>
    <div class="chip" data-k="defrost" id="c-def"><span class="dot"></span>Ontdooien</div>
    <div class="chip" data-k="online" id="c-on"><span class="dot"></span>Online</div>
    <div class="chip warn" data-k="fault" id="c-fault"><span class="dot"></span>Storing</div>
  </div>
  <div class="grid">
    <div class="stat" data-k="power"><div class="k">Elektrisch</div><div class="v" id="s-pw">–</div></div>
    <div class="stat" data-k="flow"><div class="k">Warmte-afgifte</div><div class="v" id="s-heat">–</div></div>
    <div class="stat" data-k="power"><div class="k">COP (actueel)</div><div class="v" id="s-cop">–</div></div>
    <div class="stat" data-k="energy_today"><div class="k">Vandaag</div><div class="v" id="s-today">–</div></div>
    <div class="stat" data-k="mode"><div class="k">Modus</div><div class="v" id="s-mode">–</div></div>
    <div class="stat" data-k="curve"><div class="k">Werkstand · stooklijn</div><div class="v" id="s-curve">–</div></div>
  </div>
</ha-card>`;
    this._root.querySelectorAll("[data-k]").forEach((el) => el.addEventListener("click", (ev) => {
      ev.stopPropagation(); const k = el.dataset.k; this._more(k === "dt" ? "supply" : k);
    }));
    this._$ = (id) => this._root.getElementById(id);
  }

  _update() {
    if (!this._hass || !this._root) return;
    const $ = this._$, svg = $("svg");
    const set = (id, t) => { const el = $(id); if (el && el.textContent !== t) el.textContent = t; };
    const sup = this._num("supply"), ret = this._num("return"), flow = this._num("flow");
    const compHz = this._num("comp_hz"), fanHz = this._num("fan_hz");
    const pwRaw = this._num("power"), pw = /^kw$/i.test(this._unit("power")) ? pwRaw * 1000 : pwRaw;
    const comp = Number.isFinite(compHz) ? compHz > 0 : this._on("compressor");
    const fan = Number.isFinite(fanHz) ? fanHz > 0 : comp;
    const flowing = Number.isFinite(flow) ? flow > 0.5 : comp;
    const defrost = this._on("defrost"), online = this._on("online");
    const faultVal = this._num("fault"), fault = Number.isFinite(faultVal) ? faultVal !== 0 : this._on("fault");
    const power = this._on("power_switch") || !this._st("power_switch");
    const modeS = this._st("mode"), mode = modeS ? modeS.state : "";
    const cooling = /cool/i.test(mode) && !/heat|water/i.test(mode);

    // cv-pomp: aan zolang de thermostaat vraagt (hvac_action heating/cooling)
    const th = this._st("thermostat");
    const act = th ? String(th.attributes.hvac_action || "").toLowerCase() : "";
    const cvOn = th ? act === "heating" || act === "cooling" : flowing;

    svg.classList.toggle("comp-on", comp);
    svg.classList.toggle("fan-on", fan);
    svg.classList.toggle("flow-on", flowing);
    svg.classList.toggle("sec-on", cvOn);
    svg.classList.toggle("defrost", defrost);
    svg.classList.toggle("warm", cvOn && !cooling && Number.isFinite(sup) && sup >= 24);
    if (fan) svg.style.setProperty("--fan-s", `${Math.max(0.35, Math.min(2.5, 40 / Math.max(fanHz || 20, 1))).toFixed(2)}s`);
    if (flowing) svg.style.setProperty("--flow-s", `${Math.max(0.5, Math.min(3, 14 / Math.max(flow || 10, 1))).toFixed(2)}s`);

    const cs = this._col(sup), cr = this._col(ret);
    const mid = this._col(Number.isFinite(sup) && Number.isFinite(ret) ? (sup + ret) / 2 : sup);
    for (const id of ["p-sup", "f-sup", "p-a", "f-a"]) $(id).style.stroke = cs;
    for (const id of ["p-b", "f-b"]) $(id).style.stroke = mid;
    for (const id of ["p-ret", "f-ret", "p-c", "f-c"]) $(id).style.stroke = cr;
    $("b-top").setAttribute("stop-color", cs); $("b-bot").setAttribute("stop-color", cr);
    this._root.querySelectorAll(".radcol").forEach((r) => (r.style.fill = mid));

    const T = (v) => (Number.isFinite(v) ? `${this._fmt(v, 0)} °C` : "–");
    set("v-buf", T(sup)); set("v-sup", T(sup)); set("v-ret", T(ret));
    set("v-flow", Number.isFinite(flow) ? `${this._fmt(flow, 1)} L/min` : "–");
    set("v-amb", T(this._num("ambient"))); set("v-coil", T(this._num("coil")));
    set("v-exh", T(this._num("exhaust"))); set("v-suc", T(this._num("suction")));
    set("v-hps", T(this._num("hp_sat")));
    set("v-eev", `${this._fmt(this._num("eev"), 0)} ${this._unit("eev", "P")}`);
    set("v-comp", Number.isFinite(compHz) ? `${this._fmt(compHz, 0)} ${this._unit("comp_hz", "Hz")}` : comp ? "aan" : "uit");
    set("v-fan", Number.isFinite(fanHz) ? `${this._fmt(fanHz, 0)} ${this._unit("fan_hz", "Hz")}` : fan ? "aan" : "uit");
    const thS = this._st("thermostat"), thC = thS ? parseFloat(thS.attributes.current_temperature) : NaN, thT = thS ? parseFloat(thS.attributes.temperature) : NaN;
    set("v-emos", Number.isFinite(thC) ? `${this._fmt(thC, 1)}° → ${this._fmt(thT, 1)}°` : "–");
    set("v-set", T(this._num("setpoint")));
    const dt = sup - ret;
    set("v-dt", Number.isFinite(dt) ? `${this._fmt(dt, 1)} K` : "–");

    // warmte = debiet (L/min) / 60 × 4,186 kJ/kgK × ΔT  → kW
    const heat = Number.isFinite(flow) && Number.isFinite(dt) && flowing ? (flow / 60) * 4.186 * Math.abs(dt) : NaN;
    set("s-pw", Number.isFinite(pw) ? (pw >= 1000 ? `${this._fmt(pw / 1000, 2)} kW` : `${this._fmt(pw, 0)} W`) : "–");
    set("s-heat", Number.isFinite(heat) ? `${this._fmt(heat, 2)} kW` : "–");
    const cop = comp && Number.isFinite(heat) && pw > 150 ? heat / (pw / 1000) : NaN;
    set("s-cop", Number.isFinite(cop) && cop < 12 ? this._fmt(cop, 1) : "–");
    set("s-today", `${this._fmt(this._num("energy_today"), 2)} kWh`);
    set("s-mode", mode ? HPM_MODE_NL[mode] || mode : "–");
    const wm = this._st("work_mode"), cv = this._st("curve");
    set("s-curve", `${wm ? HPM_WORK_NL[wm.state] || wm.state : "–"} · ${cv ? cv.state : "–"}`);

    const chip = (id, on) => $(id) && $(id).classList.toggle("on", on);
    chip("c-comp", comp); chip("c-fan", fan); chip("c-flow", flowing); chip("c-cv", cvOn);
    chip("c-def", defrost); chip("c-on", online); chip("c-fault", fault);

    let txt = "Stand-by", cls = "";
    if (!power) txt = "Uit";
    else if (fault) { txt = `Storing (${this._fmt(faultVal, 0)})`; cls = "fault"; }
    else if (defrost) { txt = "Ontdooien"; cls = "defrost"; }
    else if (comp && cooling) { txt = `Koelen · ${this._fmt(compHz, 0)} Hz`; cls = "cool"; }
    else if (comp) { txt = `Verwarmen · ${this._fmt(compHz, 0)} Hz`; cls = "heat"; }
    else if (flowing) txt = "Circulatie (compressor uit)";
    set("status", txt); $("status").className = `status ${cls}`;
  }
}
if (!customElements.get("heatpump-monoblock-card")) customElements.define("heatpump-monoblock-card", HeatpumpMonoblockCard);
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "heatpump-monoblock-card"))
  window.customCards.push({ type: "heatpump-monoblock-card", name: "Warmtepomp monoblock (geanimeerd)", description: "Monoblock-buitenunit met open verdeler, circulatiepomp en radiatoren in serie" });
