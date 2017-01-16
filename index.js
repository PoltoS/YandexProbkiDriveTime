/*** YandexProbkiDriveTime Z-Way HA module *******************************************

Version: 1.0.0
(c) Z-Wave.Me, 2016
-----------------------------------------------------------------------------
Author: Poltorak Serguei <ps@z-wave.me>
Description: Drive time with jams according to Yandex.Probki

******************************************************************************/

// ----------------------------------------------------------------------------
// --- Class definition, inheritance and setup
// ----------------------------------------------------------------------------

function YandexProbkiDriveTime (id, controller) {
    // Call superconstructor first (AutomationModule)
    YandexProbkiDriveTime.super_.call(this, id, controller);
}

inherits(YandexProbkiDriveTime, AutomationModule);

_module = YandexProbkiDriveTime;

// ----------------------------------------------------------------------------
// --- Module instance initialized
// ----------------------------------------------------------------------------

YandexProbkiDriveTime.prototype.init = function (config) {
    YandexProbkiDriveTime.super_.prototype.init.call(this, config);

    var self = this;
    
    this.iconPrefix = "/ZAutomation/api/v1/load/modulemedia/" + this.constructor.name + "/light";
    this.iconSuffix = ".png";
    
    this.greenColor = { red: 0x20, green: 0xbd, blue: 0x24 };
    this.yellowColor = { red: 0xfb, green: 0xc2, blue: 0x2e };
    this.redColor = { red: 0xe8, green: 0x52, blue: 0x53 };

    this.vDev = this.controller.devices.create({
        deviceId: "YandexProbkiDriveTime_" + this.id,
        defaults: {
            deviceType: "sensorMultilevel",
            metrics: {
                probeTitle: "minutes",
                scaleTitle: "мин",
                icon: this.iconPrefix + "Unknown" + this.iconSuffix
            }
        },
        overlay: {},
        handler: function (command) {
            if (command === "update") {
                self.fetchToken();
            }
        },
        moduleId: this.id
    });

    this.timer = setInterval(function() {
        self.fetchToken();
    }, 10*60*1000);
    this.fetchToken();
};

YandexProbkiDriveTime.prototype.stop = function () {
    YandexProbkiDriveTime.super_.prototype.stop.call(this);

    if (this.timer) {
        clearInterval(this.timer);
    }
        
    if (this.vDev) {
        this.controller.devices.remove(this.vDev.id);
        this.vDev = null;
    }
};

// ----------------------------------------------------------------------------
// --- Module methods
// ----------------------------------------------------------------------------

YandexProbkiDriveTime.prototype.fetchToken = function() {
    var self = this;
    
    http.request({
        url: "https://api-maps.yandex.ru/2.1.45/?lang=ru_RU",
        async: true,
        success: function(response) {
            if (typeof response.data !== "string") {
                self.updateVDev(null);
            }

            var m = response.data.match(/"token":"([^"]*)"/);
            if (!m) {
                self.updateVDev(null);
            }
        
            self.fetchDriveTime(m[1]);
        },
        error: function() {
            self.updateVDev(null);
        }
    });
};

YandexProbkiDriveTime.prototype.fetchDriveTime = function(token) {
    var self = this;
    
    http.request({
        url: "https://api-maps.yandex.ru/services/route/2.0/?lang=ru_RU&token=" + token + "&rll=" + this.config.lat1 + "%2C" + this.config.long1 + "~" + this.config.lat2 + "%2C" + this.config.long2,
        async: true,
        success: function(response) {
            if (typeof response.data !== "object") {
                self.updateVDev(null);
            }
            
            try {
                var routeMetaData = response.data.data.features[0].properties.RouteMetaData;
                
                if (routeMetaData.type !== "driving") {
                    self.updateVDev(null);
                }
                
                self.updateVDev(routeMetaData.DurationInTraffic.value / 60);
            } catch (e) {
                self.updateVDev(null);
            }
        },
        error: function() {
            self.updateVDev(null);
        }
    });
};


YandexProbkiDriveTime.prototype.setScene = function(scene) {
    var vDev = this.controller.devices.get(scene);
    if (vDev) {
        vDev.performCommand("on");
    }
};

YandexProbkiDriveTime.prototype.setRGB = function(color) {
    var vDev = this.controller.devices.get(this.config.rgbDevice);
    if (vDev) {
        vDev.performCommand("exact", color);
    }
};

YandexProbkiDriveTime.prototype.updateVDev = function(timeMinutes) {
    var icon;
    
    if (timeMinutes === null) {
        // unknown value or fetch error
        icon = "Unknown";
    } else if (timeMinutes < this.config.greenMaxTime) {
        icon = "Green";
    } else if (timeMinutes < this.config.yellowMaxTime) {
        icon = "Yellow";
    } else {
        icon = "Red";
    }

    this.vDev.set("metrics:level", timeMinutes);
    this.vDev.set("metrics:icon", this.iconPrefix + icon + this.iconSuffix);
    
    switch(icon) {
        case "Green":
            this.setScene(this.config.greenScene);
            this.setRGB(this.greenColor);
            break;
        case "Yellow":
            this.setScene(this.config.yellowScene);
            this.setRGB(this.yellowColor);
            break;
        case "Red":
            this.setScene(this.config.redScene);
            this.setRGB(this.redColor);
            break;
    }
};
