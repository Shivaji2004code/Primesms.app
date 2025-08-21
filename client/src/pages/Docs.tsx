import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { FileText, Book, Code, ExternalLink, Download } from 'lucide-react';

export default function Docs() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Documentation</h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Everything you need to get started with Prime SMS WhatsApp Business API
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Quick Start Guide */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Book className="h-6 w-6 text-emerald-600" />
              <CardTitle>Quick Start Guide</CardTitle>
            </div>
            <CardDescription>
              Get up and running with Prime SMS in minutes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Learn how to set up your WhatsApp Business account, create templates, and send your first message.
            </p>
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Read Guide
            </Button>
          </CardContent>
        </Card>

        {/* API Reference */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Code className="h-6 w-6 text-blue-600" />
              <CardTitle>API Reference</CardTitle>
            </div>
            <CardDescription>
              Complete API documentation with examples
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Detailed documentation for all API endpoints, webhooks, and integration methods.
            </p>
            <Button variant="outline" size="sm">
              <Code className="h-4 w-4 mr-2" />
              View API Docs
            </Button>
          </CardContent>
        </Card>

        {/* Templates Guide */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <FileText className="h-6 w-6 text-purple-600" />
              <CardTitle>Templates Guide</CardTitle>
            </div>
            <CardDescription>
              Create and manage WhatsApp message templates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Learn how to create, submit, and manage WhatsApp Business message templates.
            </p>
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" />
              Template Docs
            </Button>
          </CardContent>
        </Card>

        {/* Webhook Setup */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <ExternalLink className="h-6 w-4 text-orange-600" />
              <CardTitle>Webhook Setup</CardTitle>
            </div>
            <CardDescription>
              Configure webhooks for real-time updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Set up webhooks to receive delivery reports and incoming messages.
            </p>
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Webhook Guide
            </Button>
          </CardContent>
        </Card>

        {/* SDK Downloads */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Download className="h-6 w-6 text-green-600" />
              <CardTitle>SDK & Libraries</CardTitle>
            </div>
            <CardDescription>
              Download SDKs for popular programming languages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              <Badge variant="secondary">JavaScript</Badge>
              <Badge variant="secondary">Python</Badge>
              <Badge variant="secondary">PHP</Badge>
            </div>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download SDKs
            </Button>
          </CardContent>
        </Card>

        {/* Support */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <FileText className="h-6 w-6 text-red-600" />
              <CardTitle>Support & FAQ</CardTitle>
            </div>
            <CardDescription>
              Get help and find answers to common questions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Browse our FAQ, submit support tickets, and connect with our team.
            </p>
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Get Support
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Documentation Status */}
      <Card className="bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Documentation Status
              </h3>
              <p className="text-gray-600">
                Our documentation is continuously updated. Last updated: {new Date().toLocaleDateString()}
              </p>
            </div>
            <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
              Up to Date
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}