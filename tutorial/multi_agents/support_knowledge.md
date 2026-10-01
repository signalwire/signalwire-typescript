# PC Builder Pro Technical Support Knowledge Base

## Common Boot Issues

### PC Won't Turn On At All
1. **Check Power Connection**
   - Ensure power cable is firmly connected to PSU and wall outlet
   - Try a different power cable or outlet
   - Check if PSU power switch is in ON position (|)

2. **Test Power Supply**
   - Paperclip test: Bridge green wire to any black wire
   - Listen for fan spin
   - Consider PSU tester or multimeter

3. **Reseat Components**
   - Remove and reinstall RAM (one stick at a time)
   - Reseat GPU in PCIe slot
   - Check 24-pin and CPU power connectors

4. **Clear CMOS**
   - Remove CMOS battery for 5 minutes
   - Use CMOS reset jumper if available
   - May need to reconfigure BIOS settings

### PC Powers On But No Display
1. **Monitor and Cable Issues**
   - Try different display cable (HDMI/DisplayPort)
   - Test monitor with another device
   - Ensure monitor input source is correct
   - Check if GPU requires additional power cables

2. **RAM Troubleshooting**
   - Try one stick of RAM in slot A2
   - Test each stick individually
   - Check motherboard QVL for compatibility
   - Try lower speed if XMP/DOCP enabled

3. **GPU Issues**
   - Reseat graphics card
   - Try integrated graphics if available
   - Test with different PCIe slot
   - Check for bent pins in PCIe slot

4. **BIOS/UEFI Issues**
   - Reset CMOS to defaults
   - Update BIOS if possible
   - Check for diagnostic LEDs/codes
   - Listen for beep codes

### System Crashes/Blue Screens

### BSOD Error Codes
- **IRQL_NOT_LESS_OR_EQUAL**: Usually driver or RAM issue
- **PAGE_FAULT_IN_NONPAGED_AREA**: RAM or storage problem
- **SYSTEM_SERVICE_EXCEPTION**: Driver conflict
- **KERNEL_SECURITY_CHECK_FAILURE**: Often hardware failure

### Diagnostic Steps
1. **Check Event Viewer**
   - Windows Logs > System for critical errors
   - Look for patterns before crashes
   - Note any driver failures

2. **Run Memory Test**
   - Windows Memory Diagnostic
   - MemTest86 for thorough testing
   - Test one stick at a time

3. **Check Storage Health**
   - CrystalDiskInfo for SMART data
   - chkdsk /f for file system errors
   - Consider drive replacement if failing

4. **Driver Updates**
   - Update chipset drivers first
   - GPU drivers from manufacturer
   - Avoid driver update utilities

## Performance Issues

### High Temperatures
1. **CPU Overheating**
   - Normal temps: 30-50°C idle, 60-85°C load
   - Check thermal paste application
   - Ensure cooler is properly mounted
   - Verify CPU fan is spinning

2. **GPU Overheating**
   - Normal temps: 30-50°C idle, 65-85°C load
   - Clean dust from heatsink/fans
   - Check case airflow direction
   - Consider undervolting

3. **Case Airflow**
   - Front/bottom intake, rear/top exhaust
   - Positive pressure reduces dust
   - Cable management improves airflow
   - Dust filters need regular cleaning

### Low FPS in Games
1. **Check Background Processes**
   - Close unnecessary applications
   - Disable Windows Game Mode/DVR
   - Check for mining malware

2. **Power Settings**
   - Set Windows to High Performance
   - Disable CPU power saving in BIOS
   - Ensure GPU power target at 100%

3. **Driver Issues**
   - Clean install GPU drivers with DDU
   - Disable GPU scheduling
   - Check for game-specific driver issues

4. **Hardware Bottlenecks**
   - Monitor CPU/GPU usage in games
   - Check RAM running at rated speed
   - Ensure PCIe x16 slot usage

## Storage Problems

### SSD Not Detected
1. **Check Connections**
   - M.2: Ensure fully seated, correct slot
   - SATA: Both data and power cables
   - Some M.2 slots share SATA ports

2. **BIOS Settings**
   - Enable M.2 slot if disabled
   - Check SATA mode (AHCI recommended)
   - Update BIOS for NVMe support

3. **Initialize in Windows**
   - Disk Management > Initialize Disk
   - Create partition and format
   - Assign drive letter

### Slow Performance
1. **Check Drive Health**
   - CrystalDiskMark for speeds
   - Check for overheating (throttling)
   - Ensure proper drivers installed

2. **Optimize Settings**
   - Enable TRIM for SSDs
   - Disable indexing on SSDs
   - Keep 10-20% free space

## Network/Connectivity Issues

### No Internet Connection
1. **Hardware Check**
   - Ethernet: Check cable and LEDs
   - WiFi: Ensure antennas connected
   - Try different port/cable

2. **Driver Issues**
   - Download drivers on another device
   - Uninstall and reinstall network adapter
   - Check Device Manager for errors

3. **Windows Network Reset**
   - netsh winsock reset
   - netsh int ip reset
   - ipconfig /release and /renew

### Bluetooth Problems
1. **Enable in BIOS**
   - Some boards disable by default
   - Check for WiFi/BT combo setting

2. **Driver Installation**
   - Install chipset drivers first
   - Get Bluetooth drivers from motherboard vendor
   - May need separate WiFi and BT drivers

## BIOS/UEFI Issues

### Can't Enter BIOS
1. **Try Different Keys**
   - Common: DEL, F2, F10, F12
   - Spam key during boot
   - Try with PS/2 keyboard

2. **Fast Boot Issues**
   - Hold Shift while clicking Restart
   - Advanced startup > UEFI settings
   - May need to clear CMOS

### BIOS Update Problems
1. **Safe Update Practices**
   - Use UPS during update
   - Use BIOS flashback if available
   - Don't update unless necessary

2. **Recovery Options**
   - BIOS flashback button
   - Dual BIOS switch
   - CH341A programmer (advanced)

## Warranty and RMA Process

### Before RMA
1. **Confirm Warranty Status**
   - Register products when purchased
   - Keep receipts/invoices
   - Check manufacturer warranty period

2. **Document Issues**
   - Take photos/videos of problems
   - Note all troubleshooting steps
   - Get error codes/messages

### RMA Best Practices
- Contact manufacturer support first
- Get RMA number before shipping
- Use original packaging if possible
- Insure shipment for value
- Keep tracking information

## Advanced Troubleshooting Tools

### Software Tools
- **HWiNFO64**: Comprehensive monitoring
- **Prime95**: CPU stress testing
- **FurMark**: GPU stress testing
- **CrystalDiskInfo**: Storage health
- **BlueScreenView**: BSOD analysis

### Hardware Tools
- **PSU Tester**: Quick PSU validation
- **POST Card**: Diagnostic codes
- **Multimeter**: Voltage testing
- **Thermal Camera**: Hot spot detection

## Preventive Maintenance

### Regular Cleaning
- Clean dust filters monthly
- Compressed air for components
- Replace thermal paste yearly
- Check cable connections

### Software Maintenance
- Keep drivers updated
- Regular malware scans
- Disk cleanup and defrag (HDD only)
- Monitor temperatures regularly

### Backup Strategies
- 3-2-1 rule: 3 copies, 2 different media, 1 offsite
- Regular system image backups
- Cloud backup for important data
- Test restore procedures