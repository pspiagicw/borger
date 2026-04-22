package dashboard

import (
	"context"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"time"

	"borger/internal/borgmatic"
)

type dataSource interface {
	List(ctx context.Context) ([]borgmatic.ListEntry, error)
}

type Service struct {
	source dataSource
	nowFn  func() time.Time
}

func NewService(source dataSource, nowFn func() time.Time) *Service {
	return &Service{source: source, nowFn: nowFn}
}

type ViewModel struct {
	GeneratedAt  string
	Latest       *LatestBackupView
	Repositories []RepositoryView
	Error        string
}

type LatestBackupView struct {
	Repository string
	Timestamp  string
	Ago        string
}

type RepositoryView struct {
	ID             string
	Name           string
	LocationFull   string
	LocationMasked string
	Latest         string
	LatestAgo      string
	Archives       []ArchiveView
}

type ArchiveView struct {
	Name      string
	Timestamp string
	Ago       string
}

type parsedArchive struct {
	Name string
	Time time.Time
}

func (s *Service) Build(ctx context.Context) ViewModel {
	now := s.nowFn().UTC()
	entries, err := s.source.List(ctx)
	if err != nil {
		return ViewModel{
			GeneratedAt: formatGeneratedAt(now),
			Error:       err.Error(),
		}
	}

	repositories := make([]RepositoryView, 0, len(entries))
	var globalLatestRepo string
	var globalLatestTime time.Time
	foundLatest := false

	for idx, entry := range entries {
		repoName := chooseRepoName(entry.Repository)
		parsed := make([]parsedArchive, 0, len(entry.Archives))

		for _, archive := range entry.Archives {
			archiveTime, ok := parseArchiveTime(archive)
			if !ok {
				continue
			}
			parsed = append(parsed, parsedArchive{Name: archive.Name, Time: archiveTime})
		}

		sort.Slice(parsed, func(i, j int) bool {
			return parsed[i].Time.After(parsed[j].Time)
		})

		repoView := RepositoryView{
			ID:             fmt.Sprintf("repo-%d", idx),
			Name:           repoName,
			LocationFull:   entry.Repository.Location,
			LocationMasked: maskLocation(entry.Repository.Location),
			Archives:       make([]ArchiveView, 0, len(parsed)),
		}

		if len(parsed) > 0 {
			repoView.Latest = formatTimestampLong(parsed[0].Time)
			repoView.LatestAgo = timeAgo(now.Sub(parsed[0].Time))
		}

		for _, archive := range parsed {
			repoView.Archives = append(repoView.Archives, ArchiveView{
				Name:      archive.Name,
				Timestamp: formatTimestampShort(archive.Time),
				Ago:       timeAgo(now.Sub(archive.Time)),
			})
		}

		if len(parsed) > 0 && (!foundLatest || parsed[0].Time.After(globalLatestTime)) {
			globalLatestRepo = repoName
			globalLatestTime = parsed[0].Time
			foundLatest = true
		}

		repositories = append(repositories, repoView)
	}

	sort.Slice(repositories, func(i, j int) bool {
		return strings.ToLower(repositories[i].Name) < strings.ToLower(repositories[j].Name)
	})

	vm := ViewModel{
		GeneratedAt:  formatGeneratedAt(now),
		Repositories: repositories,
	}

	if foundLatest {
		vm.Latest = &LatestBackupView{
			Repository: globalLatestRepo,
			Timestamp:  formatTimestampLong(globalLatestTime),
			Ago:        timeAgo(now.Sub(globalLatestTime)),
		}
	}

	return vm
}

func chooseRepoName(repo borgmatic.Repository) string {
	if repo.Label != "" {
		return repo.Label
	}

	host := extractHost(repo.Location)
	if host != "" {
		return fmt.Sprintf("Repository @ %s", host)
	}

	if repo.Location == "" {
		return "Unknown Repository"
	}
	return "Repository"
}

func extractHost(location string) string {
	if location == "" {
		return ""
	}

	if strings.Contains(location, "://") {
		parsed, err := url.Parse(location)
		if err == nil {
			host := parsed.Host
			if host != "" {
				if strings.Contains(host, "@") {
					parts := strings.Split(host, "@")
					return parts[len(parts)-1]
				}
				return host
			}
		}
	}

	if strings.Contains(location, "@") {
		parts := strings.SplitN(location, "@", 2)
		rest := parts[1]
		if strings.Contains(rest, ":") {
			return strings.SplitN(rest, ":", 2)[0]
		}
		return rest
	}

	return ""
}

func maskLocation(location string) string {
	if location == "" {
		return "Location unavailable"
	}

	host := extractHost(location)
	if host != "" {
		return fmt.Sprintf("%s (hidden)", host)
	}

	if len(location) <= 18 {
		return "location hidden"
	}

	return location[:10] + "..." + location[len(location)-8:]
}

func parseArchiveTime(archive borgmatic.Archive) (time.Time, bool) {
	candidates := []string{archive.Time, archive.Start}
	for _, value := range candidates {
		if value == "" {
			continue
		}

		for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04:05.000000"} {
			t, err := time.Parse(layout, value)
			if err == nil {
				if t.Location() != time.UTC {
					t = t.UTC()
				}
				return t, true
			}
		}

		t, err := time.ParseInLocation("2006-01-02T15:04:05.000000", value, time.UTC)
		if err == nil {
			return t.UTC(), true
		}
	}
	return time.Time{}, false
}

func formatTimestampLong(ts time.Time) string {
	return ts.UTC().Format("Monday, January 2, 2006 at 15:04 UTC")
}

func formatTimestampShort(ts time.Time) string {
	return ts.UTC().Format("Jan 2, 2006 at 15:04 UTC")
}

func formatGeneratedAt(ts time.Time) string {
	return ts.UTC().Format("Monday, January 2, 2006 at 15:04:05 UTC")
}

func timeAgo(delta time.Duration) string {
	if delta < 0 {
		return "in the future"
	}
	if delta < time.Minute {
		return "just now"
	}

	units := []struct {
		name string
		dur  time.Duration
	}{
		{"day", 24 * time.Hour},
		{"hour", time.Hour},
		{"minute", time.Minute},
	}

	for _, unit := range units {
		if delta >= unit.dur {
			value := int(delta / unit.dur)
			suffix := unit.name
			if value > 1 {
				suffix += "s"
			}
			return fmt.Sprintf("%d %s ago", value, suffix)
		}
	}

	return "just now"
}
