/*** YandexProbkiDriveTime Z-Way HA module *******************************************

Version: 1.0.0
(c) Z-Wave.Me, 2016
-----------------------------------------------------------------------------
Author: Poltorak Serguei <ps@z-wave.me>
Description: Traffic Jam info from point to point from Yandex

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
    
    this.iconPrefix = "/ZAutomation/api/v1/load/modulemedia/" + this.constructor.name + "/";
    this.iconSuffix = ".png";

    this.vDev = self.controller.devices.create({
        deviceId: "YandexProbkiDriveTime_" + this.id,
        defaults: {
            deviceType: "sensorMultilevel",
            metrics: {
                probeTitle: "minutes",
                scaleTitle: "мин",
                icon: this.iconPrefix + "Unknown" + this.iconSuffix
            }
        },
        moduleId: this.id
    });

    this.timer = setInterval(function() {
        self.fetchToken(self);
    }, 10*60*1000);
    self.fetchToken(self);
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
    }});
};

YandexProbkiDriveTime.prototype.fetchToken = function(token) {
    var self = this;
    
    http.request({
        url: "https://api-maps.yandex.ru/services/route/2.0/?lang=ru_RU&token=" + token + "&rll=" + this.config.lat1 + "%2C" + this.config.long1 + "~" + this.config.lat1 + "%2C" + this.config.long2,
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
        }
    });
};

YandexProbkiDriveTime.prototype.updateVDev(timeMinutes) {
    if (timeMinutes === null) {
        // unknown value or fetch error
        icon = "Unknown";
    } else if (timeMinutes < this.config.greenMaxMinutes) {
        icon = "Green";
    } else if (timeMinutes < this.config.yellowMaxMinutes) {
        icon = "Yellow";
    } else {
        icon = "Red";
    }

    self.vDev.set("metrics:level", timeMinutes);
    self.vDev.set("metrics:icon", this.iconPrefix + icon + this.iconSuffix);
};
