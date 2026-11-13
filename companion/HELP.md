## Samsung Smart TV Control

### Configuration

When connecting for the first time, please make sure your TV is turned on, connected to your network (preferably via Ethernet). Enable Companion to connect by Settings > General > External Device Manager > Device Connect Manager > Access Notification is set to "**First Time Only**". If you set it to "Always Ask" you will be prompted every time Companion tries to connect to your TV (which can be very often!).

Enter your TV's IP address in Companion and click "Save". The MAC address is only needed for Power On (Wake-on-LAN); if you leave it blank it is filled in automatically when the TV is found on the network. The TV will show a pop-up asking to allow **Bitfocus Connection** to control it. Choose **Allow** within about 30 seconds. The TV then issues a pairing token, which is saved to this connection's **Pairing Token** field so you won't be asked again. To pair again (for example after resetting or replacing the TV), clear the Pairing Token field and save.

If the TV keeps prompting to allow the connection, or never accepts commands, make sure **Limit TLS to 1.2** is enabled. Some newer TVs fail the secure connection when TLS 1.3 is used.

**Note:** Because your TV may remain off for large periods of time, make sure you are using a static IP address or have a DHCP reservation set for your TV, otherwise when reconnecting to your network it may assume a new address.

### Supported Models

While this module should work with any Samsung Smart TV it has been specifically tested with the following TVs models:

- UE43NU7400
- UN55NU7100
- UN50MU6070
- LH70BETHLGFXGO

### Available Actions

- Set Power State (On / Off)
- Send Button Command

### Feedbacks

- Power: TV is on

### Variables

- `power_state`: `on`, `standby`, `off` (TV not reachable) or `unknown`. Checked every 5 seconds.

### Presets

Ready-made buttons for Power, Volume, Channel, Navigation, Inputs, Playback and Numbers.
