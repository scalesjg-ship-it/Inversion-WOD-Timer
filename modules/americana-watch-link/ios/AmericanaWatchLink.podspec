require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'AmericanaWatchLink'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = { :type => 'UNLICENSED' }
  s.author         = 'Americana'
  s.homepage       = 'https://github.com/scalesjg-ship-it/Inversion-WOD-Timer'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '15.0'
  }
  s.swift_version  = '5.9'
  s.source         = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,swift}'
  s.frameworks = 'Network'
  # DeviceDiscoveryUI is the tvOS picker. Weak so an iPhone build does not require it.
  s.weak_frameworks = 'DeviceDiscoveryUI'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
