#include <SPI.h>
#include <RH_RF69.h>

#define RF69_FREQ 434.0
#define RFM69_INT     3  // 
#define RFM69_CS      4  //
#define RFM69_RST     2  //


// Singleton instance of the radio driver
RH_RF69 rf69(RFM69_CS, RFM69_INT);


void setup()
{
    
    pinMode(RFM69_RST, OUTPUT);

    digitalWrite (RFM69_RST, HIGH);
    delay (100);
    digitalWrite (RFM69_RST, LOW);
    delay (100);

    Serial.println("LoRa Daughter Board (RFM69) - Transceiver");
    Serial.println();
    if (!rf69.init()) {
        Serial.println("init failed");
    }

    // Defaults after init are 434.0MHz, modulation GFSK_Rb250Fd250, +13dbM (for low power module)
    // No encryption
    if (!rf69.setFrequency(RF69_FREQ))
    Serial.println("setFrequency failed");

    rf69.setTxPower(20, true);

    // The encryption key has to be the same as the one in the client
    uint8_t key[] = { 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
                    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08};
    rf69.setEncryptionKey(key);

    Serial.println("RFM69 Initialization Success!");

    //Serial.print("RFM69 Frequency: ");  Serial.print((int)RF69_FREQ);  Serial.println(" MHz");
    Serial.begin(9600);
}

bool inImageMode = false;

void receive() {
  if (rf69.available()) { 
    uint8_t buf[RH_RF69_MAX_MESSAGE_LEN];
    uint8_t len = sizeof(buf);
    if (rf69.recv(buf, &len)) {
      // Convert received data to String for marker checking
      String receivedStr = String((char*)buf);
      receivedStr = receivedStr.substring(0, len);
      
      // Check for start marker
      if (receivedStr.indexOf("#IMGS") != -1) {
        inImageMode = true;
        Serial.println(receivedStr); // Print the marker as chars
        return;
      }
      
      // Check for end marker
      if (receivedStr.indexOf("#IMGE") != -1) {
        inImageMode = false;
        Serial.println(receivedStr); // Print the marker as chars
        return;
      }
      
      // Print data based on mode
      if (inImageMode) {
        // Print as hex during image transmission
        for (uint8_t i = 0; i < len; i++) {
          if (buf[i] < 0x10) Serial.write('0');
          Serial.print(buf[i], HEX);
        }
        Serial.println();
      } else {
        // Print as chars for normal operation
        Serial.write(buf, len);
        Serial.println();
      }
    }
  }
}

void sendMarker(const char* marker) {
    if (rf69.send((uint8_t*) marker, strlen(marker))) {
        Serial.print("Sending "); Serial.println(marker);
    }
}

void loop() {
    if (Serial.available()) {
        String received = Serial.readString();
        received.trim();
        if (received == "#TIMG") {
            sendMarker("#TIMG");
            delay(1000);
        }
    }
  receive();
  
}