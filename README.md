a very lightweight plugin that makes two accessories as lights to see the solar power (as a proportion of the max solar generation capacity of your array) and your battery 

it uses the givenergy api to operate, but there may be a way to query the inverter directly

heres a suggested json

{
  "platform": "GivEnergy",
  "name": "GivEnergy",
  "apiKey": "YOUR_API_KEY",
  "inverterId": "YOUR_INVERTER_ID",
  "queryFrequency": 60000,  // Query frequency in milliseconds
  "maxSolarPower": 6100     // Maximum solar power in watts
}


