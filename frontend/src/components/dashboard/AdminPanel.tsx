'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/types';
import { usersApi, pointsApi } from '@/lib/api';
import { 
  Settings, 
  Users, 
  Award, 
  Plus, 
  Edit, 
  Trash2, 
  Save,
  X,
  Shield,
  Database,
  BarChart3
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PointRule {
  id: string;
  name: string;
  category: 'certificate' | 'event' | 'workshop' | 'manual';
  points: number;
  description: string;
  active: boolean;
}

interface SystemSetting {
  key: string;
  value: string;
  description: string;
  type: 'string' | 'number' | 'boolean';
}

export default function AdminPanel() {
  const { user, hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'points' | 'settings'>('users');
  const [loading, setLoading] = useState(true);
  
  // Users management
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Points rules management
  const [pointRules, setPointRules] = useState<PointRule[]>([
    {
      id: '1',
      name: 'Certificate Approval',
      category: 'certificate',
      points: 10,
      description: 'Points awarded for approved certificate',
      active: true
    },
    {
      id: '2',
      name: 'Event Participation',
      category: 'event',
      points: 5,
      description: 'Points for attending events',
      active: true
    },
    {
      id: '3',
      name: 'Workshop Completion',
      category: 'workshop',
      points: 15,
      description: 'Points for completing workshops',
      active: true
    }
  ]);
  const [editingRule, setEditingRule] = useState<PointRule | null>(null);
  const [showRuleForm, setShowRuleForm] = useState(false);
  
  // System settings
  const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([
    {
      key: 'max_file_size',
      value: '10',
      description: 'Maximum file size for uploads (MB)',
      type: 'number'
    },
    {
      key: 'auto_approve_certificates',
      value: 'false',
      description: 'Automatically approve all certificates',
      type: 'boolean'
    },
    {
      key: 'notification_email',
      value: 'admin@university.edu',
      description: 'Email for system notifications',
      type: 'string'
    },
    {
      key: 'points_reset_semester',
      value: 'false',
      description: 'Reset points at semester start',
      type: 'boolean'
    }
  ]);

  useEffect(() => {
    if (user && hasRole(['admin'])) {
      fetchUsers();
    }
  }, [user, hasRole]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersApi.getUsers();
      setUsers(response.users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (userId: number, updates: Partial<User>) => {
    try {
      await usersApi.updateUser(userId, updates);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
      setEditingUser(null);
      toast.success('User updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await usersApi.deleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('User deleted successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleAwardPoints = async (userId: number, points: number, reason: string) => {
    try {
      await pointsApi.addPoints(userId, points, reason);
      toast.success(`Awarded ${points} points to user`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to award points');
    }
  };

  const handleSavePointRule = (rule: PointRule) => {
    if (editingRule?.id) {
      setPointRules(prev => prev.map(r => r.id === rule.id ? rule : r));
    } else {
      setPointRules(prev => [...prev, { ...rule, id: Date.now().toString() }]);
    }
    setEditingRule(null);
    setShowRuleForm(false);
    toast.success('Point rule saved successfully');
  };

  const handleDeletePointRule = (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    setPointRules(prev => prev.filter(r => r.id !== ruleId));
    toast.success('Point rule deleted');
  };

  const handleSaveSettings = () => {
    // In a real app, this would save to backend
    toast.success('Settings saved successfully');
  };

  if (!hasRole(['admin'])) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Access Required</h2>
          <p className="text-gray-600">You need administrator privileges to access this panel.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
          <p className="text-gray-600 mt-2">Manage users, point rules, and system settings</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="flex space-x-8">
            {[
              { key: 'users', label: 'Users', icon: Users },
              { key: 'points', label: 'Point Rules', icon: Award },
              { key: 'settings', label: 'Settings', icon: Settings }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === key
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">User Management</h2>
                <div className="text-sm text-gray-500">
                  Total Users: {users.length}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {editingUser?.id === user.id ? (
                            <select
                              value={editingUser.role}
                              onChange={(e) => setEditingUser({
                                ...editingUser,
                                role: e.target.value as any
                              })}
                              className="input text-sm"
                            >
                              <option value="student">Student</option>
                              <option value="faculty">Faculty</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              user.role === 'admin' ? 'bg-red-100 text-red-800' :
                              user.role === 'faculty' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            {editingUser?.id === user.id ? (
                              <>
                                <button
                                  onClick={() => handleUpdateUser(user.id, { role: editingUser.role })}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingUser(null)}
                                  className="text-gray-600 hover:text-gray-900"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => setEditingUser(user)}
                                  className="text-primary-600 hover:text-primary-900"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setSelectedUser(user)}
                                  className="text-green-600 hover:text-green-900"
                                  title="Award Points"
                                >
                                  <Award className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Point Rules Tab */}
        {activeTab === 'points' && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Point Rules</h2>
                <button
                  onClick={() => {
                    setEditingRule({
                      id: '',
                      name: '',
                      category: 'certificate',
                      points: 0,
                      description: '',
                      active: true
                    });
                    setShowRuleForm(true);
                  }}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Rule
                </button>
              </div>

              <div className="grid gap-4">
                {pointRules.map((rule) => (
                  <div key={rule.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium text-gray-900">{rule.name}</h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            rule.category === 'certificate' ? 'bg-blue-100 text-blue-800' :
                            rule.category === 'event' ? 'bg-green-100 text-green-800' :
                            rule.category === 'workshop' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {rule.category}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            rule.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {rule.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{rule.description}</p>
                        <p className="text-lg font-semibold text-primary-600">{rule.points} points</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            setEditingRule(rule);
                            setShowRuleForm(true);
                          }}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePointRule(rule.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">System Settings</h2>
                <button
                  onClick={handleSaveSettings}
                  className="btn btn-primary flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>

              <div className="space-y-6">
                {systemSettings.map((setting) => (
                  <div key={setting.key} className="border-b border-gray-200 pb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </label>
                    <p className="text-sm text-gray-500 mb-2">{setting.description}</p>
                    
                    {setting.type === 'boolean' ? (
                      <select
                        value={setting.value}
                        onChange={(e) => setSystemSettings(prev =>
                          prev.map(s => s.key === setting.key ? { ...s, value: e.target.value } : s)
                        )}
                        className="input max-w-xs"
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : (
                      <input
                        type={setting.type === 'number' ? 'number' : 'text'}
                        value={setting.value}
                        onChange={(e) => setSystemSettings(prev =>
                          prev.map(s => s.key === setting.key ? { ...s, value: e.target.value } : s)
                        )}
                        className="input max-w-md"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Point Rule Form Modal */}
        {showRuleForm && editingRule && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium mb-4">
                {editingRule.id ? 'Edit' : 'Add'} Point Rule
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={editingRule.name}
                    onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                    className="input"
                    placeholder="Rule name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={editingRule.category}
                    onChange={(e) => setEditingRule({ ...editingRule, category: e.target.value as any })}
                    className="input"
                  >
                    <option value="certificate">Certificate</option>
                    <option value="event">Event</option>
                    <option value="workshop">Workshop</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                  <input
                    type="number"
                    value={editingRule.points}
                    onChange={(e) => setEditingRule({ ...editingRule, points: parseInt(e.target.value) || 0 })}
                    className="input"
                    placeholder="0"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={editingRule.description}
                    onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                    className="input"
                    rows={3}
                    placeholder="Rule description"
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editingRule.active}
                    onChange={(e) => setEditingRule({ ...editingRule, active: e.target.checked })}
                    className="mr-2"
                  />
                  <label className="text-sm text-gray-700">Active</label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowRuleForm(false);
                    setEditingRule(null);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSavePointRule(editingRule)}
                  className="btn btn-primary"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Award Points Modal */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium mb-4">Award Points</h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  <strong>User:</strong> {selectedUser.full_name} ({selectedUser.email})
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                  <input
                    type="number"
                    className="input"
                    placeholder="Enter points to award"
                    id="award-points"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <textarea
                    className="input"
                    rows={3}
                    placeholder="Reason for awarding points"
                    id="award-reason"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const pointsInput = document.getElementById('award-points') as HTMLInputElement;
                    const reasonInput = document.getElementById('award-reason') as HTMLTextAreaElement;
                    const points = parseInt(pointsInput.value);
                    const reason = reasonInput.value;
                    
                    if (points && reason) {
                      handleAwardPoints(selectedUser.id, points, reason);
                      setSelectedUser(null);
                    } else {
                      toast.error('Please enter points and reason');
                    }
                  }}
                  className="btn btn-primary"
                >
                  Award Points
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}