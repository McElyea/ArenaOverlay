import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface DraftEvent {
  pack: string[];
  pick: number;
  pickedCards: string[];
}

export class LogMonitor {
  private logPath: string;
  private currentSize: number = 0;
  private watchInterval: NodeJS.Timeout | null = null;

  constructor(customPath?: string) {
    this.logPath = customPath || this.getDefaultPath();
  }

  private getDefaultPath(): string {
    const home = os.homedir();
    const username = os.userInfo().username;
    
    const paths = [
      // Windows - Default
      path.join(home, 'AppData', 'LocalLow', 'Wizards Of The Coast', 'MTGA', 'Player.log'),
      // Windows - Steam/Other Drives
      'C:/Program Files (x86)/Steam/steamapps/compatdata/2141910/pfx/drive_c/users/steamuser/AppData/LocalLow/Wizards Of The Coast/MTGA/Player.log',
      'D:/AppData/LocalLow/Wizards Of The Coast/MTGA/Player.log',
      
      // macOS
      path.join(home, 'Library', 'Logs', 'Wizards Of The Coast', 'MTGA', 'Player.log'),
      
      // Linux - Bottles
      path.join(home, '.var', 'app', 'com.usebottles.bottles', 'data', 'bottles', 'bottles', 'MTG-Arena', 'drive_c', 'users', username, 'AppData', 'LocalLow', 'Wizards Of The Coast', 'MTGA', 'Player.log'),
      // Linux - Lutris
      path.join(home, 'Games', 'magic-the-gathering-arena', 'drive_c', 'users', username, 'AppData', 'LocalLow', 'Wizards Of The Coast', 'MTGA', 'Player.log'),
    ];

    for (const p of paths) {
      if (fs.existsSync(p)) {
        console.log(`Found Arena log at: ${p}`);
        return p;
      }
    }

    // Fallback to default
    return paths[0];
  }

  public start(onDraftEvent: (event: DraftEvent) => void) {
    console.log(`Monitoring log at: ${this.logPath}`);
    
    if (!fs.existsSync(this.logPath)) {
      console.error('Log file not found');
      return;
    }

    const stats = fs.statSync(this.logPath);
    this.currentSize = stats.size;

    this.watchInterval = setInterval(() => {
      const newStats = fs.statSync(this.logPath);
      if (newStats.size > this.currentSize) {
        this.processNewLines(onDraftEvent);
        this.currentSize = newStats.size;
      } else if (newStats.size < this.currentSize) {
        // Log truncated/rotated
        this.currentSize = newStats.size;
      }
    }, 1000);
  }

  private processNewLines(onDraftEvent: (event: DraftEvent) => void) {
    const stream = fs.createReadStream(this.logPath, {
      start: this.currentSize,
      encoding: 'utf8'
    });

    stream.on('data', (chunk: string) => {
      // MTGA logs can contain multiple JSON blobs per line or split across chunks
      // We look for the specific Draft.Notify patterns
      if (chunk.includes('Draft.Notify')) {
        this.parseChunk(chunk, onDraftEvent);
      }
    });
  }

  private parseChunk(chunk: string, onDraftEvent: (event: DraftEvent) => void) {
    const draftPackRegex = /"DraftPack":\s*\[(.*?)\]/g;
    const pickedCardsRegex = /"PickedCards":\s*\[(.*?)\]/g;

    let packMatch = draftPackRegex.exec(chunk);
    let pickedMatch = pickedCardsRegex.exec(chunk);

    if (packMatch) {
      try {
        const cardIds = packMatch[1].split(',').map(id => id.trim().replace(/"/g, ''));
        const pickedIds = pickedMatch ? pickedMatch[1].split(',').map(id => id.trim().replace(/"/g, '')) : [];
        
        onDraftEvent({
          pack: cardIds,
          pick: 0,
          pickedCards: pickedIds
        });
      } catch (e) {
        console.error('Failed to parse draft event', e);
      }
    }
  }

  public stop() {
    if (this.watchInterval) clearInterval(this.watchInterval);
  }
}
