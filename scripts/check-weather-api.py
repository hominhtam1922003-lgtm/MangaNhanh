#!/usr/bin/env python3
"""Smoke test nguồn thật tại tâm Mỹ Tho, không phải kiểm tra GPS trên điện thoại."""
import json
import urllib.parse
import urllib.request

params = {
    "latitude": "10.36", "longitude": "106.36",
    "current": "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day",
    "hourly": "temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,uv_index,is_day",
    "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    "timezone": "auto", "timeformat": "unixtime", "forecast_days": "7",
    "wind_speed_unit": "kmh", "temperature_unit": "celsius", "precipitation_unit": "mm",
}
url = "https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(params)
request = urllib.request.Request(url, headers={"User-Agent": "LichNhac-CI-smoke-test/1.1"})
with urllib.request.urlopen(request, timeout=25) as response:
    data = json.load(response)
assert isinstance(data["current"]["time"], (int, float))
assert len(data["hourly"]["time"]) >= 24
assert len(data["daily"]["time"]) == 7
assert "is_day" in data["hourly"]
assert data["current_units"]["wind_speed_10m"] == "km/h"
print("HTTP 200: tham số thời tiết ứng dụng được nguồn thật chấp nhận.")
print(json.dumps({"source": "Open-Meteo", "timezone": data["timezone"],
                  "model_latitude": data["latitude"], "model_longitude": data["longitude"],
                  "current": data["current"], "forecast_days": len(data["daily"]["time"])}, ensure_ascii=False))
print("Đây là điểm lưới dự báo ở tâm Mỹ Tho; không chứng minh GPS hoặc thời tiết chính xác 100%.")
