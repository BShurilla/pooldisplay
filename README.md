# Home Assistant Pool Dashboard

A web-based dashboard for monitoring and controlling a pool system integrated with Home Assistant. I wanted my pool to be as smart as most everything else in my home, so I needed a way to control the pool from the "Pump House." This dashboard displays real-time data (temperature, chemistry, pump RPM, flow rates) and provides manual controls for pump speed and Quick Clean mode. To be straight up, I’m not a coder, nor do I claim to be. I built this using ChatGPT for about 90% of the code, with Grok stepping in to clean it up and fix a few issues ChatGPT couldn’t solve. You can swap out much of the setup for whatever works for you, as long as the required entities are populated in Home Assistant. The website is designed to run on a 10.1" 1024x600 touchscreen display connected to a Raspberry Pi, mounted on the front panel of my control cabinet.

My current pool is a modest 15' 48" round pool, about 5,000 gallons. I target just over three water turnovers daily, totaling 18,000 gallons. Starting at 8 AM, this takes until around 3:30 PM, according to my flow sensor. I achieve this in three stages, or speeds: 3000 RPM, 2450 RPM, and 1700 RPM. In the future, I plan to add automation so the kids can use our voice assistant (currently Amazon Alexa) to pause the pump for several hours or run it at a low 1200 RPM when they want to swim. I’m not yet sure which approach is better. There’s also a Quick Clean mode, useful for skimmer-style vacuums or, in my case, ensuring the pump runs for eight hours after adding chemicals later in the day. It’s set to run at 1950 RPM for eight hours when activated. Feel free to adjust these settings to suit your pool.

For the pump, I use a Century V-Green 1.65 HP Variable Speed Pump, controlled via an ESP32 with RS-485, using Gazoodle’s CenturyVSPump code (https://github.com/gazoodle/CenturyVSPump). Unfortunately, the ESP32 M5Stack ATOM RS-485 module Gazoodle used has been discontinued. Instead, I opted for an ACEIRMC D1 Mini NodeMCU ESP32 paired with a WWZMDiB TTL to RS-485 to UART Converter. This setup is specific because my house has an outdoor "closet" in the basement where the pump and filter reside. I built a metal enclosure wired like a PLC cabinet to house all the control and monitoring electronics, so I chose ESP32 solutions that could be cased and mounted on a DIN rail. For the ESP32 enclosure, I used this Printables model: https://www.printables.com/model/1089412-esp32-din-rail-enclosure-rs485.

In addition to the ESP32, I have an Industrial Shields 10 I/Os PLC controller. This was my initial ESP32, but despite trying various AI-generated code, I couldn’t get the RS-485 protocol/commands to work. I’m confident a skilled programmer could make it work, but I gave up after the first pool season. I now use this ESP32 to read the water flow sensor and plan to wire motors to actuate two valves in the plumbing. For the water flow sensor, I’m using this one: https://www.amazon.com/dp/B07MY6JHNR. Note that it has BSPT threads, not NPT, so in the U.S., some users report sealing it with enough Teflon tape. I wasn’t successful with that, so I bought BSPT-to-slip sockets online, which sealed perfectly. Calibration was tricky; hand-calibrating with a gallon of water didn’t match, so I used the Amazon listing’s suggested settings, and the numbers seem realistic. Your mileage may vary. I also plan to install a pressure transducer in my cartridge filter and integrate its data via this ESP32.

For chemistry and pool water temperature, I use an iopool EcO sensor with a gateway. It’s been decent in my first season with it, and I love the continuous monitoring. Since this pool and house are temporary until we build and install an in-ground pool, it works well for now. I followed this guide to integrate the sensor with Home Assistant (French, but Edge’s translator was sufficient): https://www.hacf.fr/gestion-piscine-iopool/. When the iopool suggests maintenance, I use a TF-Pro kit to run a full water test and follow the Pool Math app for adjustments. I tried online converters to calculate Free Chlorine ppm from ORP, pH, and water temperature, but found no reliable conversion. For our future in-ground pool, I’ll likely use an Atlas Scientific setup and a WaterGuru skimmer lid, as I prefer liquid chlorine over tablets. Ultimately, how you get chemistry data into Home Assistant doesn’t matter, as long as the entities are populated. You can even remove the chemistry section entirely; I just wanted to maximize this display’s functionality.

With all this setup reporting to Home Assistant, you’ll need several scripts, automations, helpers, and a webhook. These are included as best I can in the HASS folder, with .txt files for each helper. For the Start Quick Clean Mode automation, create a webhook in Home Assistant and keep it local-only. If sharing files online, ensure the webhook ID is scrubbed.

I host this website on a Docker host at home, so the setup is geared toward that, but you can run it locally on a Raspberry Pi or possibly as a Home Assistant add-on if desired.

## Features
- **Real-Time Monitoring**: Pool/air temperature, pH, ORP, pump status, flow rates (GPM/GPH), and gallons processed.
- **Status Indicators**: Color-coded lights for pool, chemistry, and pump status.
- **Manual Controls**: Buttons for 3000, 2450, 1700 RPM, Quick Clean mode, and pump on/off.
- **Responsive UI**: Gauges and progress bars for flow and RPM metrics.
- **Docker Deployment**: Easy setup with Docker Compose and environment variables.

## Prerequisites
- **Home Assistant**: Running with entities for pool sensors (`sensor.temperature_iopool_pool`, `sensor.esp32_pool_pump_pump_actual_rpm`, etc.).
- **Docker**: Installed for containerized deployment.
- **Node.js**: For local development (optional).
- **Gauge.js**: Required for gauge visuals (`gauge.min.js`).

## Setup

1. **Add Dependencies**:
   - Download `gauge.min.js` from [Gauge.js](http://github.com/bernii/gauge.js/) and place it in `public/`.
   - Add a `favicon.ico` to `public/` (e.g., generate one at [favicon.io](https://favicon.io/)).

2. **Configure Environment**:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env`:
     ```
     HASS_TOKEN=your_long_lived_access_token
     HASS_BASE_URL=http://your-ha-ip:8123
     QUICK_CLEAN_WEBHOOK=your_quick_clean_webhook_id
     ```
   - **Generate Token**: In Home Assistant, go to Profile → Long-Lived Access Tokens → Create Token.
   - **Webhook ID**: Create a webhook in Home Assistant (e.g., via Automation → Webhook trigger) for Quick Clean.

3. **Deploy with Docker Compose**:
   ```bash
   docker-compose up -d
   ```
   - Access the dashboard at `http://localhost:8080`.

4. **Optional: Local Development**:
   ```bash
   npm install
   node server.js
   ```
   - Access at `http://localhost:80`.

## File Structure
- `Dockerfile`: Docker image configuration.
- `docker-compose.yml`: Docker Compose service definition.
- `package.json`: Node.js dependencies.
- `.env`: Environment variables (not committed).
- `server.js`: Express server with proxy to Home Assistant.
- `public/`:
  - `index.html`: Dashboard HTML.
  - `app.js`: Client-side logic.
  - `style.css`: Stylesheet.
  - `gauge.min.js`: Gauge library (not included).
  - `favicon.ico`: Favicon (not included).

## Environment Variables
| Variable           | Description                                    |
|--------------------|-----------------------------------------------|
| `HASS_TOKEN`       | Home Assistant long-lived access token.       |
| `HASS_BASE_URL`    | Home Assistant instance URL (e.g., `http://192.168.1.100:8123`). |
| `QUICK_CLEAN_WEBHOOK` | Webhook ID for Quick Clean mode.            |

## Usage
- **Dashboard**: View real-time pool metrics and status lights.
- **Controls**:
  - **RPM Buttons**: Set pump speed (3000, 2450, 1700 RPM).
  - **Quick Clean**: Toggle 8-hour cleaning mode with timer.
  - **Pump On/Off**: Toggle pump state.
- **Status Lights**:
  - **Pool Status**: Blue (off/manual + good chemistry), Green (schedule), Yellow (issues).
  - **Chemistry**: Green (ideal), Blue (action needed), Red (error).
  - **Pump**: Blue (manual), Green (schedule), Off (off), Red (error).

## Troubleshooting
- **No Data**: Check `HASS_BASE_URL` and `HASS_TOKEN`. Verify entity IDs in Home Assistant.
- **Webhook Fails**: Ensure the webhook is configured in Home Assistant.
- **Gauge Errors**: Confirm `gauge.min.js` is in `public/`.
- **Console Errors**: Check browser console (F12) and server logs (`docker logs pooldashboard`).

## Contributing
1. Fork the repo.
2. Create a feature branch (`git checkout -b feature/your-feature`).
3. Commit changes (`git commit -m "Add feature"`).
4. Push to GitHub (`git push origin feature/your-feature`).
5. Open a Pull Request.

## License
MIT License

## Security
- Keep `.env` private and never commit sensitive tokens.
- Use HTTPS for Home Assistant in production.