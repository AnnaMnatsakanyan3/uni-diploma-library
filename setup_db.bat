@echo off
cd C:\Users\Asus Vivio\Desktop\uni_diploma
C:\xampp\mysql\bin\mysql.exe -u root --password= < database_setup.sql
echo.
echo Database setup complete!
echo.
echo Verifying tables:
C:\xampp\mysql\bin\mysql.exe -u root --password= -e "USE uni_diploma; SHOW TABLES;"
pause
