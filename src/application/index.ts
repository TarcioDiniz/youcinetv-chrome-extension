interface SerieDto {
  id: string;
  name: string;
  episodes: NodeListOf<HTMLButtonElement>;
}

interface SerieProgressDto {
  serie: SerieDto;
  currentEpisode: number;
  qtdEpisodes: number;
}

interface VideoProgressDto {
  isPaused: boolean;
  currentTime: string;
  duration: string;
  isFinished: boolean;
}

interface EpisodeDetailsDto {
  currentTime: string;
  duration: string;
  isFinished: boolean;
  currentEpisode: number;
}

interface ISerieDetails {
  getId(): Promise<string>;

  getName(): Promise<string>;

  getEpisodes(): Promise<NodeListOf<HTMLButtonElement>>;

  getCurrentEpisode(buttons: NodeListOf<HTMLButtonElement>): Promise<number>;
}

interface ISerieService {
  getSerie(): Promise<SerieProgressDto>;

  getVideo(): Promise<any>;

  nextEpisode(button: HTMLButtonElement): Promise<any>;

  getVideoProgress(): Promise<VideoProgressDto>;

  saveEpisodeDetails(serieId: string, episodeDetails: EpisodeDetailsDto): Promise<void>;

  getEpisodeDetails(serieId: string): Promise<EpisodeDetailsDto>;
}

class SerieDetails implements ISerieDetails {
  getId(): Promise<string> {
    const url = window.location.href;
    const matches = url.match(/vod\/details\/0\/([A-Za-z0-9]+)/);

    const serieId = matches ? matches[1] : null;
    if (!serieId) {
      return Promise.reject(new Error('Serie ID not found'));
    }

    return Promise.resolve(serieId);
  }

  getName(): Promise<string> {
    const serieNameElement = document.querySelector('.movies-name.text-bold.q-my-sm.text-h5');

    if (!serieNameElement) {
      return Promise.reject(new Error('Serie name element not found'));
    }

    return Promise.resolve(serieNameElement.textContent);
  }

  getEpisodes(): Promise<NodeListOf<HTMLButtonElement>> {
    const scrollAreaContentDiv = document.querySelector('.q-scrollarea__content.absolute');

    if (scrollAreaContentDiv) {
      const totalEpisodesDiv = scrollAreaContentDiv.querySelector('.row.no-wrap');

      if (totalEpisodesDiv) {
        const buttons = totalEpisodesDiv.querySelectorAll('button');
        return Promise.resolve(buttons);

      }
    }

    return Promise.reject(new Error('Episodes not found'));
  }

  getCurrentEpisode(buttons: NodeListOf<HTMLButtonElement>): Promise<number> {
    let selectedButtonIndex = -1;
    buttons.forEach((button, index) => {
      const span = button.querySelector('.q-btn__content.text-center.col.items-center.q-anchor--skip.justify-center.row');
      if (span) {
        const icon = span.querySelector('i.q-icon.notranslate.material-icons');
        if (icon) {
          selectedButtonIndex = index;
        }
      }
    });

    if (selectedButtonIndex !== -1) {
      return Promise.resolve(selectedButtonIndex);
    }

    return Promise.reject(new Error('Current episode not found'));
  }
}

class SerieService implements ISerieService {
  private serieDetails: ISerieDetails;

  constructor(serieDetails: ISerieDetails = new SerieDetails()) {
    this.serieDetails = serieDetails;
  }

  async nextEpisode(button: HTMLButtonElement): Promise<any> {
    try {
      button.click();
      await new Promise(resolve => setTimeout(resolve, 2000));
      button.click();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async getSerie(): Promise<SerieProgressDto> {
    const [id, name, episodes] = await Promise.all([
      this.serieDetails.getId(),
      this.serieDetails.getName(),
      this.serieDetails.getEpisodes()
    ]);

    return {
      serie: {
        id: id,
        name: name,
        episodes: episodes
      },
      currentEpisode: await this.serieDetails.getCurrentEpisode(episodes),
      qtdEpisodes: episodes.length,
    }
  }

  getVideo(): Promise<any> {
    const videoElement = document.querySelector('video');
    return videoElement ? Promise.resolve(videoElement) : Promise.reject(new Error('Video element not found'));
  }

  async getVideoProgress(): Promise<VideoProgressDto> {
    try {
      const videoElement = await this.getVideo();

      const isPaused = videoElement.paused;
      const currentTime = videoElement.currentTime;
      const duration = videoElement.duration;

      const formatTime = (time: number): string => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
      };

      const isFinished = currentTime >= duration;

      return {
        isPaused: isPaused,
        currentTime: formatTime(currentTime),
        duration: formatTime(duration),
        isFinished: isFinished
      };
    } catch (error) {
      return Promise.reject(error);
    }
  }

  saveEpisodeDetails(serieId: string, episodeDetails: EpisodeDetailsDto): Promise<void> {
    console.log('Salvando detalhes do episódio:', episodeDetails);
    localStorage.setItem(`currentEpisode-${serieId}`, JSON.stringify(episodeDetails));
    return Promise.resolve();
  }

  getEpisodeDetails(serieId: string): Promise<EpisodeDetailsDto> {
    const episodeDetails = localStorage.getItem(`currentEpisode-${serieId}`);

    if (episodeDetails) {
      return Promise.resolve(JSON.parse(episodeDetails));
    }

    return Promise.reject(new Error('Current episode not found'));
  }

}

class Application {

  private serieService: ISerieService;
  private serieDetails: ISerieDetails;

  constructor(serieService: ISerieService = new SerieService(), serieDetails: ISerieDetails = new SerieDetails()) {
    this.serieService = serieService;
    this.serieDetails = serieDetails;
  }

  async videoProgress() {
    const serie = await this.serieService.getSerie();

    try {
      const episodeDetails = await this.serieService.getEpisodeDetails(serie.serie.id);

      console.log('Detalhes do episódio:', episodeDetails);

      if (episodeDetails && episodeDetails.isFinished) {
        console.log('Episódio concluido');

        if (serie && serie.currentEpisode + 1 < serie.qtdEpisodes) {
          console.log('Proximo episódio');
          const episode = serie.serie.episodes[episodeDetails.currentEpisode + 1];
          await this.serieService.nextEpisode(episode);
        }
      }

      if (episodeDetails && !episodeDetails.isFinished) {
        console.log('Proximo não concluido');
        const episode = serie.serie.episodes[episodeDetails.currentEpisode];
        await this.serieService.nextEpisode(episode);
      }

      const intervalId = setInterval(async () => {
        let progress = await this.serieService.getVideoProgress();
        let episodes = await this.serieDetails.getEpisodes();

        const episodeDetails: EpisodeDetailsDto = {
          currentEpisode: await this.serieDetails.getCurrentEpisode(episodes),
          duration: progress.duration,
          currentTime: progress.currentTime,
          isFinished: progress.isFinished
        };

        await this.serieService.saveEpisodeDetails(serie.serie.id, episodeDetails);

        if (progress.isFinished) {
          if (serie && serie.currentEpisode + 1 < serie.qtdEpisodes) {
            const episode = serie.serie.episodes[serie.currentEpisode + 1];
            await this.serieService.nextEpisode(episode);
          } else {
            clearInterval(intervalId);
            console.log("Fim dos episódios ou condição não atendida");
          }
        }
      }, 5000);

    } catch (error) {
      console.log(error);
    }
  }
}

const application = new Application();

application.videoProgress().then();