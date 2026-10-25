// Bathroom thermostat (Moes BHT-002 on Slacky custom FW r01, fork alexeykin1984/tuya_thermostat_zrd).
// Our firmware passes local temperature calibration in whole degrees (-30..+30),
// so show and write it as-is instead of the standard x0.1 scaling.
import {definitions} from "zigbee-herdsman-converters/devices/slacky_diy";
import * as exposes from "zigbee-herdsman-converters/lib/exposes";

const e = exposes.presets;
const base = definitions.find((d) => d.zigbeeModel?.includes("Tuya_Thermostat_r01"));

const fzCalibration = {
    cluster: "hvacThermostat",
    type: ["attributeReport", "readResponse"],
    convert: (model, msg) => {
        if (msg.data.localTemperatureCalibration !== undefined) {
            return {local_temperature_calibration: msg.data.localTemperatureCalibration};
        }
    },
};

const tzCalibration = {
    key: ["local_temperature_calibration"],
    convertSet: async (entity, key, value) => {
        const v = Math.max(-30, Math.min(30, Math.round(Number(value))));
        await entity.write("hvacThermostat", {localTemperatureCalibration: v});
        return {state: {local_temperature_calibration: v}};
    },
    convertGet: async (entity) => {
        await entity.read("hvacThermostat", ["localTemperatureCalibration"]);
    },
};

const climate = e
    .climate()
    .withLocalTemperature()
    .withSetpoint("occupied_heating_setpoint", 5, 45, 1)
    .withLocalTemperatureCalibration(-30, 30, 1)
    .withSystemMode(["off", "heat"])
    .withRunningState(["idle", "heat"], exposes.access.STATE)
    .withWeeklySchedule(["heat"], exposes.access.ALL);

// Russian labels/descriptions for the z2m UI (property names stay the same for HA/automations)
const ru = {
    child_lock: ["Блокировка кнопок", "Блокирует кнопки на самом термостате"],
    programming_operation_mode: ["Режим работы", "setpoint — постоянная уставка, schedule — по расписанию (в нём уставка до 35)"],
    sensor: ["Датчик", "IN — встроенный (воздух), OU — выносной (пол), AL — оба"],
    deadzone_temperature: ["Гистерезис", "На сколько градусов ниже уставки включается нагрев"],
    max_heat_setpoint_limit: ["Максимальная уставка", "Верхний предел уставки"],
    local_temperature: ["Температура", "Температура с учётом калибровки (как на экране)"],
    occupied_heating_setpoint: ["Уставка", "Целевая температура (по шкале экрана)"],
    local_temperature_calibration: ["Калибровка", "Поправка к датчику в целых градусах, −30…+30 (старый датчик пола 2 кОм: −30)"],
    system_mode: ["Режим", "off — выключен, heat — нагрев"],
    running_state: ["Состояние", "idle — не греет, heat — греет"],
    weekly_schedule: ["Расписание", "Недельное расписание"],
    schedule_monday: ["Расписание будни", "Расписание на рабочие дни"],
    schedule_saturday: ["Расписание суббота", "Расписание на субботу"],
    schedule_sunday: ["Расписание воскресенье", "Расписание на воскресенье"],
    linkquality: ["Качество связи", "Качество Zigbee-связи (LQI)"],
    // weekly schedule (nested fields)
    dayofweek: ["Дни недели", "Дни, к которым применяется расписание"],
    day: ["День", "День недели"],
    transitions: ["Переключения", "Время и температура переключений"],
    transition: ["Переключение", "Время и уставка"],
    transitionTime: ["Время", "Время переключения"],
    hour: ["Час", "Часы"],
    minute: ["Минута", "Минуты"],
    heatSetpoint: ["Уставка", "Целевая температура с этого времени"],
};
const localize = (x) => {
    const t = ru[x.property ?? x.name];
    if (t) {
        x.label = t[0];
        x.description = t[1];
    }
    for (const f of x.features ?? []) localize(f);
    if (x.item_type) localize(x.item_type);
    return x;
};

export default {
    ...base,
    description: "Терморегулятор тёплого пола (Moes BHT-002, прошивка Slacky, калибровка −30…+30)",
    fromZigbee: [...base.fromZigbee, fzCalibration],
    toZigbee: [tzCalibration, ...base.toZigbee],
    exposes: base.exposes.map((x) => localize(x.type === "climate" ? climate : x.clone ? x.clone() : x)),
};
