import * as https from 'https';

let Service, Characteristic;

module.exports = (homebridge) => {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerPlatform("homebridge-givenergy-cloud", "GivEnergy", GivEnergyPlatform);
};

class GivEnergyPlatform {
  private log: any;
  private config: any;
  private apiKey: string;
  private inverterId: string;
  private accessoryList: any[];
  private maxSolarPower: number;
  private refreshRate: number;  
  constructor(log, config) {
    this.log = log;
    this.config = config;
    this.apiKey = config.apiKey;
    this.inverterId = config.inverterId
    this.accessoryList = [];
    this.maxSolarPower = this.config.maxSolarPower || 6100; //approx 15 panels worth of wats
    this.refreshRate = this.config.refreshRate || 600000; //make a query by default every 10 mins, dont know how often you can query the api
    this.discoverAccessories();
    this.fetchGivEnergyData();
  }

  discoverAccessories() {
    const solarAccessory = new GivEnergySolarAccessory(this.log, this.config, Service, Characteristic, this);
    this.accessoryList.push(solarAccessory);

    const batteryAccessory = new GivEnergyBatteryAccessory(this.log, this.config, Service, Characteristic, this);
    this.accessoryList.push(batteryAccessory);

    // Start fetching data at regular intervals
    setInterval(() => {
      this.fetchGivEnergyData();
    }, this.refreshRate); // 600,000 milliseconds = 10 minutes
  }

  accessories(callback) {
    callback(this.accessoryList);
  }

  fetchGivEnergyData() {
    this.log.info("Fetching data from GivEnergy API");
    // ... existing HTTPS request logic ...

    const options = {
      hostname: 'api.givenergy.cloud',
      path: `/v1/inverter/${this.config.inverterId}/system-data/latest`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          const solarPower = jsonData.data.solar.power;
          const solarPowerValue = Math.round(Math.min(Math.max((parseInt(solarPower) / this.maxSolarPower) * 100, 0), 100));
          const batteryPercent = jsonData.data.battery.percent;
          const batteryLevel = Math.min(Math.max(parseInt(batteryPercent), 0), 100);

          this.accessoryList.forEach(accessory => {
            if (accessory instanceof GivEnergySolarAccessory) {
              accessory.updateSolarPowerValue(solarPowerValue);
            }
            if (accessory instanceof GivEnergyBatteryAccessory) {
              accessory.updateBatteryLevel(batteryLevel);
            }
          });

          this.log.info('Data returned: Solar %', solarPowerValue, ' Battery %', batteryLevel);
        } catch (error) {
          this.log.error('Error parsing data from GivEnergy API:', error);
        }
      });
    });

    req.on('error', error => {
      this.log.error('Error making request to GivEnergy API:', error);
    });

    req.end();
  }
}

class GivEnergySolarAccessory {
  private log: any;
  private name: string;
  private Service: any;
  private Characteristic: any;
  private solarService: any;
  private solarPowerValue: number;
  private platform: any;
  constructor(log, config, Service, Characteristic, platform) {
    this.log = log;
    this.name = "Solar Power";
    this.Service = Service;
    this.Characteristic = Characteristic;
    this.solarService = new Service.Lightbulb(this.name);
    this.solarPowerValue = 0;
    this.platform = platform;

    this.solarService
      .getCharacteristic(Characteristic.Brightness)
      .on('set', this.setSolarPowerState.bind(this));
    
  }

  getServices() {
    return [this.solarService];
  }

  updateSolarPowerValue(value) {
    this.solarPowerValue = value;
    const isOn = value >0;

    this.solarService
      .getCharacteristic(Characteristic.Brightness)
      .updateValue(isOn ? this.solarPowerValue : 0);
  
    this.solarService
      .getCharacteristic(Characteristic.On)
      .updateValue(isOn);
  }
  setSolarPowerState(value, callback){
    this.updateSolarPowerValue(this.solarPowerValue);
    callback();
  }
  getSolarPower(callback) {
    callback(null, this.solarPowerValue);
  }
}
class GivEnergyBatteryAccessory {
  private log: any;
  private name: string;
  private Service: any;
  private Characteristic: any;
  private batteryService: any;
  private batteryLevel: number;
  private platform: any;

  constructor(log, config, Service, Characteristic, platform) {
    this.log = log;
    this.name = "Battery Level";
    this.Service = Service;
    this.Characteristic = Characteristic;
    this.batteryService = new Service.Lightbulb(this.name);
    this.batteryLevel = 0;
    this.platform = platform;

    this.batteryService
      .getCharacteristic(Characteristic.Brightness)
      .on('set', this.setBatteryLevelState.bind(this));
    
    // Initial update with current value
    this.updateBatteryLevel(this.batteryLevel);
  }

  getServices() {
    return [this.batteryService];
  }

  updateBatteryLevel(value) {
    this.batteryLevel = value;
    const isOn = value > 0;

    this.batteryService
      .getCharacteristic(Characteristic.Brightness)
      .updateValue(isOn ? this.batteryLevel : 0);

    this.batteryService
      .getCharacteristic(Characteristic.On)
      .updateValue(isOn);
  }

  setBatteryLevelState(value, callback) {
    
    this.updateBatteryLevel(this.batteryLevel);
    callback();
  }

  getBatteryLevel(callback) {
    callback(null, this.batteryLevel);
  }
}