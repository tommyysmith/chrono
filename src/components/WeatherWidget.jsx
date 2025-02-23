'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { env } from '@/config/env';

const API_KEY = env.WEATHER_API_KEY;
const API_HOST = env.WEATHER_API_HOST;
const CACHE_DURATION = 1000 * 60 * 10; // 10 minutes

// Default coordinates for San Francisco as fallback
const DEFAULT_COORDS = {
  latitude: 37.7749,
  longitude: -122.4194
};

const getWeatherGradient = (condition) => {
  const gradients = {
    // Clear conditions
    'Sunny': 'bg-gradient-to-br from-blue-400 to-blue-600',
    'Clear': 'bg-gradient-to-br from-blue-900 to-indigo-900',
    // Cloudy conditions
    'Partly cloudy': 'bg-gradient-to-br from-blue-300 to-blue-500',
    'Cloudy': 'bg-gradient-to-br from-gray-400 to-gray-600',
    'Overcast': 'bg-gradient-to-br from-gray-500 to-gray-700',
    // Rain conditions
    'Light rain': 'bg-gradient-to-br from-blue-600 to-gray-700',
    'Moderate rain': 'bg-gradient-to-br from-blue-700 to-gray-800',
    'Heavy rain': 'bg-gradient-to-br from-blue-800 to-gray-900',
    // Default
    default: 'bg-gradient-to-br from-blue-400 to-blue-600',
  };
  return gradients[condition] || gradients.default;
};

const WeatherWidget = ({ className }) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const fetchWeather = useCallback(async (latitude, longitude) => {
    try {
      setLoading(true);
      setError(null);

      const cachedData = localStorage.getItem('weatherData');
      const cachedTime = localStorage.getItem('weatherDataTime');
      
      if (cachedData && cachedTime) {
        const age = Date.now() - parseInt(cachedTime);
        if (age < CACHE_DURATION) {
          setWeather(JSON.parse(cachedData));
          setLoading(false);
          return;
        }
      }

      const response = await fetch(
        `https://${API_HOST}/current.json?q=${latitude},${longitude}`, 
        {
          headers: {
            'X-RapidAPI-Key': API_KEY,
            'X-RapidAPI-Host': API_HOST
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Weather data fetch failed');
      }

      const data = await response.json();
      setWeather(data);
      localStorage.setItem('weatherData', JSON.stringify(data));
      localStorage.setItem('weatherDataTime', Date.now().toString());
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const getLocation = useCallback(() => {
    setLoading(true);
    setError(null);
    setUsingFallback(false);

    if (!API_KEY || !API_HOST) {
      setError('Weather API configuration is missing');
      setLoading(false);
      return;
    }

    const handleError = (err) => {
      console.error('Geolocation error:', err);
      console.log('Using fallback location');
      setUsingFallback(true);
      fetchWeather(DEFAULT_COORDS.latitude, DEFAULT_COORDS.longitude);
    };

    if (!navigator.geolocation) {
      handleError(new Error('Geolocation is not supported'));
      return;
    }

    const options = {
      timeout: 10000,
      enableHighAccuracy: false,
      maximumAge: 300000 // 5 minutes
    };

    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        handleError,
        options
      );
    } catch (err) {
      handleError(err);
    }
  }, [fetchWeather]);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  if (loading) {
    return (
      <div className={cn("p-4 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse", className)}>
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-4 rounded-lg bg-red-50 dark:bg-red-900/20", className)}>
        <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>
        <button
          onClick={getLocation}
          className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!weather) return null;

  const { current, location } = weather;
  const temp = Math.round(current.temp_c);
  const feelsLike = Math.round(current.feelslike_c);
  const condition = current.condition.text;

  return (
    <div className={cn(
      "p-4 rounded-lg text-white shadow-lg",
      getWeatherGradient(condition),
      className
    )}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-semibold">{temp}°C</div>
          <div className="text-sm opacity-90">Feels like {feelsLike}°C</div>
          {usingFallback && (
            <div className="text-xs opacity-75 mt-1">
              Showing weather for San Francisco
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm">{condition}</div>
          <div className="text-xs opacity-90">
            Wind: {Math.round(current.wind_kph * 1000 / 3600)} m/s
          </div>
          <div className="text-xs opacity-90">
            Humidity: {current.humidity}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherWidget;
