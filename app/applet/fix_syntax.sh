#!/bin/bash
sed -i '/message: `Payment verified/,/}});    }/d' /app/applet/server.ts
