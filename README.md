# Warmtepomp Cards voor Home Assistant

Een geanimeerde dashboardkaart voor Home Assistant die live laat zien wat je warmtepomp doet: draaiende ventilator, stromend water, kleur van leidingen en tank op basis van temperatuur, ontdooi- en storingsindicatie.

| Kaart | Type |
|---|---|
| **Warmtepomp monoblock (geanimeerd)** — buitenunit, buffervat, cv-pomp, radiatoren en vloerverwarming met verdeler | `custom:heatpump-monoblock-card` |

<p align="center">
  <img src="images/monoblock.svg" alt="Warmtepomp monoblock-kaart" width="70%">
</p>
<p align="center"><em>Voorbeeld met demowaarden — in Home Assistant bewegen ventilator, compressor en waterstroom mee met de live status.</em></p>

> 🇬🇧 *Two animated Lovelace cards for a monoblock heat pump and a heat pump water heater. Labels are in Dutch; configuration is below.*

---

## Installatie

### Via HACS (aanbevolen)

1. Open **HACS** in Home Assistant.
2. Klik rechtsboven op ⋮ → **Aangepaste repositories**.
3. Plak de URL van deze repository, kies type **Dashboard** en klik **Toevoegen**.
4. Zoek **Warmtepomp Cards**, klik **Downloaden** en herlaad de browser.

[![Open in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=AMensink&repository=warmtepomp-cards&category=plugin)

### Handmatig

1. Download `dist/warmtepomp-cards.js` en zet het in `/config/www/`.
2. Ga naar **Instellingen → Dashboards → ⋮ → Resources → Resource toevoegen**.
3. URL: `/local/warmtepomp-cards.js`, type: **JavaScript-module**.
4. Herlaad de browser.

---

## Gebruik

Na installatie verschijnt de kaart in de kaartkiezer bij het bewerken van een dashboard. Omdat iedere installatie andere entiteitsnamen heeft, stel je je eigen sensoren in via de YAML-editor van de kaart onder `entities:`. Alles wat je niet invult valt terug op de standaardnamen van de **Tuya Heat Pump**-integratie (apparaatnaam `warmtepomp`). Ontbrekende entiteiten tonen gewoon `–`.

### Warmtepomp monoblock

<img src="images/monoblock.svg" alt="Voorbeeld warmtepomp monoblock-kaart" width="520">

Monoblock-buitenunit met buffervat op zolder, cv-pomp naar de radiatoren op de verdieping en vloerverwarming met eigen verdeler en pomp op de begane grond. Onderaan staan elektrisch vermogen, berekende warmte-afgifte en actuele COP.

```yaml
type: custom:heatpump-monoblock-card
title: Warmtepomp
buffer_liters: 30
entities:
  supply: sensor.warmtepomp_outlet_water_temperature   # aanvoer
  return: sensor.warmtepomp_inlet_water_temperature    # retour
  flow: sensor.warmtepomp_water_flow_rate              # debiet in L/min
  power: sensor.warmtepomp_power                       # elektrisch vermogen in W
  thermostat: climate.woonkamer                        # optioneel: stuurt de cv-pomp-animatie
  floor_pump: switch.vloerverwarming_pomp              # optioneel: pomp vloerverwarming
```

| Optie | Omschrijving |
|---|---|
| `title` | Titel van de kaart (standaard `Warmtepomp`) |
| `buffer_liters` | Inhoud buffervat die in de tekening staat (standaard `30`) |

| Entiteit | Betekenis |
|---|---|
| `supply` / `return` | Aanvoer- en retourtemperatuur water |
| `ambient` | Buitenluchttemperatuur |
| `coil` | Verdampertemperatuur |
| `exhaust` / `suction` | Pers- en zuiggastemperatuur |
| `hp_sat` | Condensatietemperatuur (hogedruk-verzadiging) |
| `eev` | Positie expansieventiel |
| `flow` | Waterdebiet (L/min) — gebruikt voor warmte-afgifte en COP |
| `fan_hz` / `comp_hz` | Frequentie ventilator / compressor |
| `compressor` | Compressor aan/uit (als er geen frequentie is) |
| `defrost` | Ontdooien aan/uit |
| `online` | Online-status |
| `fault` | Storingscode (0 = geen storing) |
| `power_switch` | Aan/uit-schakelaar warmtepomp |
| `setpoint` | Gewenste aanvoertemperatuur |
| `mode` / `work_mode` / `curve` | Modus, werkstand en stooklijn |
| `power` | Elektrisch vermogen (W) |
| `energy_today` / `energy_total` | Energie vandaag / totaal |
| `thermostat` | `climate`-entiteit; bij `hvac_action: heating` draait de cv-pomp, en de kamertemperatuur bepaalt waar de leidingkleur van blauw naar warm omslaat |
| `floor_pump` | Schakelaar/stekker van de vloerverwarmingspomp |

Klik op een waarde of onderdeel in de tekening om het detailvenster van die entiteit te openen.

---

## Goed om te weten

- De kaarten zijn gemaakt voor een Tuya-warmtepomp (Heative Next290) via de *Tuya Heat Pump*-integratie, maar werken met elke warmtepomp waarvan je vergelijkbare sensoren hebt.
- De getoonde COP is een schatting: debiet × 4,186 × ΔT gedeeld door het elektrisch vermogen.
- Animaties stoppen automatisch als je apparaat "verminderde beweging" heeft ingesteld.

## Licentie

MIT — zie [LICENSE](LICENSE).


## Wijzigingen in deze fork (B0bWa)

Monoblock-kaart aangepast voor een huis met alleen radiatoren:
- Zolder, verdieping, begane grond, vloerverwarming, verdeler en "Vloerpomp" verwijderd.
- Open verdeler (`buffer_liters`, standaard 25) in plaats van buffervat.
- Circulatiepomp met label (`pump_label`, standaard "Wilo · stand I").
- Zes radiatoren in serie (`radiators:`, lijst met namen) en thermostaatwaarde (EMOS) bij de Gang.
- Eenheid van ventilator/compressor komt uit de sensor; vermogen in kW wordt omgerekend.

De Hewalex-boilerkaart staat in een aparte repo: [B0bWa/Hewalex-boiler-card](https://github.com/B0bWa/Hewalex-boiler-card).
