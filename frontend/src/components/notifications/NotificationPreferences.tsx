'use client';

import React, { useState, useEffect } from 'react';
import { Save, Bell, Mail, MessageSquare, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { notificationsApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const preferencesSchema = z.object({
  email_enabled: z.boolean(),
  push_enabled: z.boolean(),
  sms_enabled: z.boolean(),
  quiet_hours_start: z.string().optional(),
  quiet_hours_end: z.string().optional(),
  categories: z.object({
    system: z.boolean(),
    events: z.boolean(),
    workshops: z.boolean(),
    certificates: z.boolean(),
    points: z.boolean(),
    deadlines: z.boolean(),
  }),
  priority_filters: z.object({
    low: z.boolean(),
    medium: z.boolean(),
    high: z.boolean(),
    urgent: z.boolean(),
  }),
});

type PreferencesForm = z.infer<typeof preferencesSchema>;

interface NotificationPreferencesProps {
  className?: string;
}

export function NotificationPreferences({ className }: NotificationPreferencesProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty }
  } = useForm<PreferencesForm>({
    defaultValues: {
      email_enabled: true,
      push_enabled: true,
      sms_enabled: false,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
      categories: {
        system: true,
        events: true,
        workshops: true,
        certificates: true,
        points: true,
        deadlines: true,
      },
      priority_filters: {
        low: true,
        medium: true,
        high: true,
        urgent: true,
      },
    }
  });

  const watchedValues = watch();

  // Load existing preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const response = await notificationsApi.getPreferences(user.id);
        
        if (response.preferences) {
          const prefs = response.preferences;
          setValue('email_enabled', prefs.email_enabled);
          setValue('push_enabled', prefs.push_enabled);
          setValue('sms_enabled', prefs.sms_enabled);
          setValue('quiet_hours_start', prefs.quiet_hours_start || '22:00');
          setValue('quiet_hours_end', prefs.quiet_hours_end || '08:00');
          
          // Parse JSON categories and priorities
          const categories = prefs.categories ? JSON.parse(prefs.categories) : {};
          const priorities = prefs.priority_filters ? JSON.parse(prefs.priority_filters) : {};
          
          setValue('categories', {
            system: categories.system ?? true,
            events: categories.events ?? true,
            workshops: categories.workshops ?? true,
            certificates: categories.certificates ?? true,
            points: categories.points ?? true,
            deadlines: categories.deadlines ?? true,
          });
          
          setValue('priority_filters', {
            low: priorities.low ?? true,
            medium: priorities.medium ?? true,
            high: priorities.high ?? true,
            urgent: priorities.urgent ?? true,
          });
        }
      } catch (error) {
        console.error('Failed to load preferences:', error);
        toast.error('Failed to load notification preferences');
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [user, setValue]);

  const onSubmit = async (data: PreferencesForm) => {
    if (!user) return;

    try {
      setIsSaving(true);
      
      const preferences = {
        user_id: user.id,
        email_enabled: data.email_enabled,
        push_enabled: data.push_enabled,
        sms_enabled: data.sms_enabled,
        quiet_hours_start: data.quiet_hours_start,
        quiet_hours_end: data.quiet_hours_end,
        categories: JSON.stringify(data.categories),
        priority_filters: JSON.stringify(data.priority_filters),
      };

      await notificationsApi.updatePreferences(user.id, preferences);
      
      toast.success('Notification preferences saved successfully!');
    } catch (error) {
      console.error('Failed to save preferences:', error);
      toast.error('Failed to save preferences. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className={clsx('bg-white rounded-lg shadow-md p-6', className)}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('bg-white rounded-lg shadow-md', className)}>
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Notification Preferences</h2>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Customize how and when you receive notifications
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        {/* Delivery Methods */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Methods</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-blue-600" />
                <div>
                  <label className="text-sm font-medium text-gray-900">Email Notifications</label>
                  <p className="text-xs text-gray-500">Receive notifications via email</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...register('email_enabled')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-green-600" />
                <div>
                  <label className="text-sm font-medium text-gray-900">Push Notifications</label>
                  <p className="text-xs text-gray-500">Browser and app notifications</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...register('push_enabled')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-purple-600" />
                <div>
                  <label className="text-sm font-medium text-gray-900">SMS Notifications</label>
                  <p className="text-xs text-gray-500">Text messages for urgent notifications</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...register('sms_enabled')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Quiet Hours */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quiet Hours</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                {...register('quiet_hours_start')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                {...register('quiet_hours_end')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            No push or SMS notifications will be sent during quiet hours
          </p>
        </div>

        {/* Notification Categories */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Categories</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(watchedValues.categories || {}).map(([category, enabled]) => (
              <label key={category} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register(`categories.${category}` as any)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 capitalize">
                  {category === 'points' ? 'Points & Rewards' : category}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Priority Filters */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Priority Levels</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(watchedValues.priority_filters || {}).map(([priority, enabled]) => (
              <label key={priority} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register(`priority_filters.${priority}` as any)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className={clsx(
                  'text-sm capitalize',
                  priority === 'urgent' && 'text-red-600 font-medium',
                  priority === 'high' && 'text-orange-600 font-medium',
                  priority === 'medium' && 'text-blue-600',
                  priority === 'low' && 'text-gray-600'
                )}>
                  {priority}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {isDirty && (
              <>
                <AlertCircle className="w-4 h-4" />
                <span>You have unsaved changes</span>
              </>
            )}
          </div>
          
          <button
            type="submit"
            disabled={isSaving || !isDirty}
            className={clsx(
              'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              isDirty && !isSaving
                ? 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            )}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Preferences</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}