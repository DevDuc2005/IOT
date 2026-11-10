#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// THAY THE THONG TIN WIFI / MQTT
const char* WIFI_SSID="TEN_WIFI";
const char* WIFI_PASS="MAT_KHAU_WIFI";
const char* MQTT_HOST="192.168.38.226";
const int MQTT_PORT=1884;
const char* MQTT_USER="";
const char* MQTT_PASS="";

// Day la GPIO ban da xac nhan cho LED va cam bien anh sang.
// GPIO theo cau hinh da trao doi: DHT7, LED10/1/12.
#define LIGHT_PIN 4
#define DHT_PIN 7
#define LED1_PIN 10
#define LED2_PIN 1
#define LED3_PIN 12
#define LED_ON HIGH
#define LED_OFF LOW

DHT dht(DHT_PIN,DHT11);
WiFiClient wifi;
PubSubClient mqtt(wifi);
const int ledPins[3]={LED1_PIN,LED2_PIN,LED3_PIN};
bool states[3]={false,false,false};
const char* T_SENSOR="iot/room1/sensors";
const char* T_HISTORY="iot/room1/led/history";
const char* T_STATUS="iot/room1/devices/status";
const char* T_COMMAND="iot/room1/command";
unsigned long lastSensor=0,lastWifiTry=0,lastMqttTry=0;

void publishStatus(){
  if(!mqtt.connected())return;
  char json[100];
  snprintf(json,sizeof(json),"{\"led1\":\"%s\",\"led2\":\"%s\",\"led3\":\"%s\"}",states[0]?"ON":"OFF",states[1]?"ON":"OFF",states[2]?"ON":"OFF");
  mqtt.publish(T_STATUS,json,true);
  Serial.println(json);
}
void publishHistory(int n,bool on){
  if(!mqtt.connected())return;
  char json[128];
  snprintf(json,sizeof(json),"{\"led\":%d,\"action\":\"%s\",\"result\":\"SUCCESS\",\"uptime_ms\":%lu}",n,on?"ON":"OFF",millis());
  mqtt.publish(T_HISTORY,json,false);
  Serial.println(json);
}
void setLED(int n,bool on){
  if(n<1||n>3)return;
  digitalWrite(ledPins[n-1],on?LED_ON:LED_OFF);
  states[n-1]=on;
  publishStatus();
  publishHistory(n,on);
}
void processCommand(String s){
  s.trim();s.toLowerCase();
  if(s=="all on"||s=="led all on") {for(int n=1;n<=3;n++)setLED(n,true);return;}
  if(s=="all off"||s=="led all off") {for(int n=1;n<=3;n++)setLED(n,false);return;}
  for(int n=1;n<=3;n++){
    String a="led "+String(n)+" ";
    String b="led"+String(n)+" ";
    if(s==a+"on"||s==b+"on"){setLED(n,true);return;}
    if(s==a+"off"||s==b+"off"){setLED(n,false);return;}
  }
  Serial.println("Lenh khong hop le: "+s);
}
void callback(char* topic,byte* payload,unsigned int len){
  String msg;
  for(unsigned int i=0;i<len;i++)msg+=(char)payload[i];
  String t(topic);msg.trim();
  Serial.println("MQTT: "+t+" => "+msg);
  if(t==T_COMMAND){processCommand(msg);return;}
  for(int n=1;n<=3;n++){
    String ledTopic="iot/room1/led"+String(n)+"/set";
    if(t==ledTopic){msg.toLowerCase();if(msg=="on"||msg=="1")setLED(n,true);else if(msg=="off"||msg=="0")setLED(n,false);return;}
  }
}
void connectWifi(){
  if(WiFi.status()==WL_CONNECTED)return;
  if(lastWifiTry&&millis()-lastWifiTry<5000)return;
  lastWifiTry=millis();WiFi.begin(WIFI_SSID,WIFI_PASS);Serial.println("Dang ket noi WiFi...");
}
void connectMqtt(){
  if(mqtt.connected()||WiFi.status()!=WL_CONNECTED)return;
  if(lastMqttTry&&millis()-lastMqttTry<5000)return;
  lastMqttTry=millis();
  String id="ESP32C6-"+WiFi.macAddress();id.replace(":","");
  bool ok=strlen(MQTT_USER)?mqtt.connect(id.c_str(),MQTT_USER,MQTT_PASS):mqtt.connect(id.c_str());
  if(ok){
    mqtt.subscribe(T_COMMAND);
    for(int n=1;n<=3;n++){String t="iot/room1/led"+String(n)+"/set";mqtt.subscribe(t.c_str());}
    publishStatus();Serial.println("MQTT Connected");
  }else{Serial.print("MQTT error: ");Serial.println(mqtt.state());}
}
void publishSensor(){
  float temp=dht.readTemperature(),hum=dht.readHumidity();
  int raw=digitalRead(LIGHT_PIN);
  if(isnan(temp)||isnan(hum)){Serial.println("DHT11 ERROR");return;}
  char json[170];
  snprintf(json,sizeof(json),"{\"temperature\":%.2f,\"humidity\":%.2f,\"light\":\"%s\",\"light_raw\":%d}",temp,hum,raw==0?"LIGHT":"DARK",raw);
  Serial.print("SENSOR: ");Serial.println(json);
  if(mqtt.connected())mqtt.publish(T_SENSOR,json,false);
}
void setup(){
  Serial.begin(115200);
  pinMode(LIGHT_PIN,INPUT);
  for(int i=0;i<3;i++){digitalWrite(ledPins[i],LED_OFF);pinMode(ledPins[i],OUTPUT);}
  dht.begin();WiFi.mode(WIFI_STA);
  mqtt.setServer(MQTT_HOST,MQTT_PORT);
  mqtt.setCallback(callback);mqtt.setBufferSize(512);
  connectWifi();
  lastSensor=millis()-3000;
}
void loop(){
  if(WiFi.status()!=WL_CONNECTED)connectWifi();
  else {if(!mqtt.connected())connectMqtt();if(mqtt.connected())mqtt.loop();}
  if(millis()-lastSensor>=3000){lastSensor=millis();publishSensor();}
}
